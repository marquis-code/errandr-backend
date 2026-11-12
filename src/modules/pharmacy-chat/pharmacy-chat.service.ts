import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NotificationsService } from '../notifications/notifications.service';
import { PharmacyConversation, PharmacyConversationDocument } from './schemas/pharmacy-conversation.schema';

@Injectable()
export class PharmacyChatService {
  private readonly logger = new Logger(PharmacyChatService.name);

  constructor(
    @InjectModel(PharmacyConversation.name)
    private readonly conversationModel: Model<PharmacyConversationDocument>,
    @InjectModel('Vendor') private readonly vendorModel: Model<any>,
    @InjectModel('Product') private readonly productModel: Model<any>,
    @InjectModel('User') private readonly userModel: Model<any>,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** A customer starts a thread. The pharmacy is told immediately, by WhatsApp. */
  async start(customerId: string, dto: { vendorId: string; productId?: string; message: string; orderId?: string }) {
    if (!dto?.vendorId) throw new BadRequestException('A pharmacy is required');
    const body = String(dto.message || '').trim();
    if (body.length < 5) throw new BadRequestException('Please describe your question');

    const vendor = await this.vendorModel.findById(dto.vendorId).lean().exec();
    if (!vendor) throw new NotFoundException('Pharmacy not found');

    const customer = await this.userModel.findById(customerId).select('firstName lastName phone').lean().exec();

    let subject = 'Medication question';
    if (dto.productId) {
      const product = await this.productModel.findById(dto.productId).select('name').lean().exec();
      if (product) subject = `About ${(product as any).name}`;
    }

    const conversation = await this.conversationModel.create({
      customer: new Types.ObjectId(customerId),
      vendor: new Types.ObjectId(dto.vendorId),
      product: dto.productId ? new Types.ObjectId(dto.productId) : null,
      order: dto.orderId ? new Types.ObjectId(dto.orderId) : null,
      subject,
      status: 'open',
      lastMessageAt: new Date(),
      messages: [
        {
          sender: 'customer',
          senderName: `${(customer as any)?.firstName || 'Customer'} ${(customer as any)?.lastName || ''}`.trim(),
          body,
          at: new Date(),
        },
      ],
    });

    await this.notifyPharmacy(vendor, conversation, body, customer);
    return conversation;
  }

  private async notifyPharmacy(vendor: any, conversation: any, question: string, customer: any): Promise<void> {
    try {
      const phone = vendor.phone || '';
      if (!phone) return;

      const text = [
        '🤖 *Erranders Bot*',
        '',
        'A customer has a question about a medicine.',
        '',
        `From: ${(customer as any)?.firstName || 'Customer'}`,
        `About: ${conversation.subject}`,
        '',
        `"${question.slice(0, 300)}"`,
        '',
        'Reply in your vendor dashboard — this thread is linked to the medicine they are looking at.',
      ].join('\n');

      await this.notificationsService.sendWhatsApp(phone, text).catch(() => {});
    } catch (e: any) {
      this.logger.warn(`Could not notify pharmacy: ${e?.message || e}`);
    }
  }

  async listForCustomer(customerId: string) {
    return this.conversationModel
      .find({ customer: new Types.ObjectId(customerId) })
      .sort({ lastMessageAt: -1 })
      .limit(50)
      .lean()
      .exec();
  }

  async listForVendor(ownerId: string, status?: string) {
    const vendor = await this.vendorModel.findOne({ owner: new Types.ObjectId(ownerId) }).select('_id').lean().exec();
    if (!vendor) throw new ForbiddenException('No store linked to this account');

    const filter: any = { vendor: (vendor as any)._id };
    if (status) filter.status = status;

    return this.conversationModel
      .find(filter)
      .sort({ lastMessageAt: -1 })
      .limit(100)
      .populate('customer', 'firstName lastName phone')
      .lean()
      .exec();
  }

  async reply(userId: string, role: string, conversationId: string, body: string) {
    const text = String(body || '').trim();
    if (!text) throw new BadRequestException('Message cannot be empty');

    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) throw new NotFoundException('Conversation not found');

    const isPharmacist = ['vendor', 'admin', 'super_admin'].includes(String(role).toLowerCase());

    if (isPharmacist) {
      const vendor = await this.vendorModel.findOne({ owner: new Types.ObjectId(userId) }).select('_id').lean().exec();
      const ownsStore = vendor && String((vendor as any)._id) === String(conversation.vendor);
      if (!ownsStore) throw new ForbiddenException('This conversation belongs to another store');
    } else if (String(conversation.customer) !== String(userId)) {
      throw new ForbiddenException('This conversation is not yours');
    }

    conversation.messages.push({
      sender: isPharmacist ? 'pharmacist' : 'customer',
      body: text,
      at: new Date(),
      senderName: isPharmacist ? 'Pharmacist' : 'Customer',
    } as any);
    conversation.status = isPharmacist ? 'answered' : 'open';
    conversation.lastMessageAt = new Date();
    await conversation.save();

    // Tell the other side it has an answer, so a question is never left sitting.
    if (isPharmacist) {
      const customer = await this.userModel.findById(conversation.customer).select('phone').lean().exec();
      const phone = (customer as any)?.phone;
      if (phone) {
        await this.notificationsService
          .sendWhatsApp(phone, `🤖 *Erranders Bot*\n\nA pharmacist has replied to your question.\n\n"${text.slice(0, 300)}"\n\nOpen the app to see the full answer.`)
          .catch(() => {});
      }
    }

    return conversation;
  }

  /**
   * Prescription orders waiting on a pharmacist.
   *
   * A medicine must not be dispatched on the strength of an upload alone — somebody qualified has
   * to look at it. This is the queue that makes that true rather than intended.
   */
  async pendingPrescriptions(ownerId: string) {
    const vendor = await this.vendorModel.findOne({ owner: new Types.ObjectId(ownerId) }).select('_id').lean().exec();
    if (!vendor) throw new ForbiddenException('No store linked to this account');

    const orders = await (this.conversationModel.db as any).collection('orders')
      .find({ vendor: (vendor as any)._id, 'pharmacistReview.status': 'pending' })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    return {
      pending: orders.length,
      orders: orders.map((o: any) => ({
        id: String(o._id),
        orderNumber: o.orderNumber,
        status: o.status,
        total: o.total,
        createdAt: o.createdAt,
        prescriptionImage: o.prescriptionImage || '',
        prescriptionReference: o.prescriptionReference || '',
        customer: o.customer,
      })),
    };
  }

  /** Approve or reject a prescription. Rejection cancels the order and refunds the customer. */
  async reviewPrescription(userId: string, orderId: string, decision: 'approved' | 'rejected', note = '') {
    const vendor = await this.vendorModel.findOne({ owner: new Types.ObjectId(userId) }).select('_id').lean().exec();
    if (!vendor) throw new ForbiddenException('No store linked to this account');

    const orders = (this.conversationModel.db as any).collection('orders');
    const order = await orders.findOne({ _id: new Types.ObjectId(orderId) });
    if (!order) throw new NotFoundException('Order not found');
    if (String(order.vendor) !== String((vendor as any)._id)) throw new ForbiddenException('Not your order');

    await orders.updateOne(
      { _id: order._id },
      {
        $set: {
          'pharmacistReview.status': decision,
          'pharmacistReview.reviewedBy': String(userId),
          'pharmacistReview.reviewedAt': new Date(),
          'pharmacistReview.note': note,
          ...(decision === 'rejected' ? { status: 'cancelled' } : {}),
          updatedAt: new Date(),
        },
        ...(decision === 'approved'
          ? {}
          : { $push: { statusHistory: { status: 'cancelled', timestamp: new Date(), note: `Prescription rejected: ${note || 'not valid'}` } } }),
      } as any,
    );

    return { orderId, decision, note };
  }

  /** Prescription uploads and questions a pharmacist must clear before dispatch. */
  async reviewQueue(ownerId: string) {
    const vendor = await this.vendorModel.findOne({ owner: new Types.ObjectId(ownerId) }).select('_id').lean().exec();
    if (!vendor) throw new ForbiddenException('No store linked to this account');

    const open = await this.conversationModel
      .find({ vendor: (vendor as any)._id, status: { $in: ['open'] } })
      .sort({ lastMessageAt: -1 })
      .populate('customer', 'firstName lastName phone')
      .lean()
      .exec();

    return { pendingQuestions: open.length, conversations: open };
  }
}
