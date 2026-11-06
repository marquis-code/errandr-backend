import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { GroupOrder, GroupOrderDocument } from './schemas/group-order.schema';
import { GroupOrdersGateway } from './group-orders.gateway';
import { OrdersService } from '../orders/orders.service';
import { WalletsService } from '../wallets/wallets.service';
import { PaystackService } from '../payments/paystack.service';

@Injectable()
export class GroupOrdersService {
  private readonly logger = new Logger(GroupOrdersService.name);

  constructor(
    @InjectModel(GroupOrder.name) private groupOrderModel: Model<GroupOrderDocument>,
    @InjectModel('SystemSetting') private settingModel: Model<any>,
    private readonly gateway: GroupOrdersGateway,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
    @Inject(forwardRef(() => WalletsService))
    private readonly walletsService: WalletsService,
    @Inject(forwardRef(() => PaystackService))
    private readonly paystackService: PaystackService,
  ) {}

  async create(hostId: string, vendorId?: string, name?: string, spendingLimit?: number): Promise<GroupOrder> {
    const inviteCode = uuidv4().slice(0, 8).toUpperCase();
    const vendorObjId = vendorId && Types.ObjectId.isValid(vendorId) ? new Types.ObjectId(vendorId) : undefined;
    const groupOrder = await this.groupOrderModel.create({
      host: new Types.ObjectId(hostId),
      vendor: vendorObjId,
      vendors: vendorObjId ? [vendorObjId] : [],
      inviteCode,
      name: name || `Group Order - ${new Date().toLocaleDateString()}`,
      spendingLimit,
      participants: [
        {
          user: new Types.ObjectId(hostId),
          items: [],
          isReady: false,
          total: 0,
        },
      ],
    });
    return groupOrder;
  }

  async findByCode(inviteCode: string): Promise<any> {
    const rawOrder = await this.groupOrderModel.findOne({ inviteCode }).lean();
    if (!rawOrder) throw new NotFoundException('Group order not found');

    const groupOrder = await this.groupOrderModel.findOne({ inviteCode })
      .populate('vendor', 'storeName logo banner deliveryFee packagingFee')
      .populate('vendors', 'storeName logo banner deliveryFee packagingFee')
      .populate('host', 'firstName lastName avatar')
      .populate('participants.user', 'firstName lastName avatar')
      .populate('participants.items.vendorId', 'storeName logo banner deliveryFee packagingFee')
      .lean();

    if (!groupOrder) throw new NotFoundException('Group order not found');

    if (!groupOrder.host) {
      groupOrder.host = { _id: rawOrder.host, firstName: 'Guest', lastName: '' } as any;
    }
    
    groupOrder.participants.forEach((p: any, i: number) => {
      if (!p.user) {
        p.user = { _id: rawOrder.participants[i].user, firstName: 'Guest', lastName: '' };
      }
    });

    return groupOrder;
  }

  async getUserHistory(userId: string): Promise<GroupOrderDocument[]> {
    return this.groupOrderModel.find({
      $or: [
        { host: new Types.ObjectId(userId) },
        { 'participants.user': new Types.ObjectId(userId) }
      ]
    })
    .sort({ createdAt: -1 })
    .populate('vendor', 'storeName logo banner')
    .populate('vendors', 'storeName logo banner')
    .populate('host', 'firstName lastName avatar')
    .populate('participants.user', 'firstName lastName avatar')
    .populate('participants.items.vendorId', 'storeName logo banner');
  }

  async join(userId: string, inviteCode: string): Promise<GroupOrder> {
    const groupOrder = await this.groupOrderModel.findOne({ inviteCode });
    if (!groupOrder) throw new NotFoundException('Group order not found');
    
    if (groupOrder.status !== 'open') {
      throw new BadRequestException('This group order is no longer accepting participants');
    }

    const userIdStr = userId.toString();
    const isParticipant = groupOrder.participants.some(
      (p) => p.user && p.user.toString() === userIdStr
    );

    if (!isParticipant) {
      groupOrder.participants.push({
        user: new Types.ObjectId(userId) as any,
        items: [],
        isReady: false,
        total: 0,
        hasPaid: false,
      });
      await groupOrder.save();
      
      const populated = await this.findByCode(inviteCode);
      const newUser = populated.participants.find(
        p => p.user && p.user['_id']?.toString() === userIdStr
      )?.user || { _id: userIdStr, firstName: 'Guest', lastName: '' };
      this.gateway.broadcastMemberJoined(inviteCode, newUser);
      return populated;
    }

    return this.findByCode(inviteCode);
  }

  async leave(userId: string, inviteCode: string): Promise<GroupOrder> {
    const groupOrder = await this.groupOrderModel.findOne({ inviteCode });
    if (!groupOrder) throw new NotFoundException('Group order not found');

    const userIdStr = userId.toString();
    groupOrder.participants = groupOrder.participants.filter(
      (p) => p.user && p.user.toString() !== userIdStr
    );
    await groupOrder.save();
    
    const populated = await this.findByCode(inviteCode);
    this.gateway.broadcastUpdate(inviteCode, populated);
    return populated;
  }

  async updateItems(userId: string, inviteCode: string, items: any[]): Promise<GroupOrder> {
    const groupOrder = await this.groupOrderModel.findOne({ inviteCode });
    if (!groupOrder) throw new NotFoundException('Group order not found');
    
    if (groupOrder.status !== 'open') {
      throw new BadRequestException('Cannot update items in a locked or completed order');
    }

    const userIdStr = userId.toString();
    const participantIndex = groupOrder.participants.findIndex(
      (p) => p.user && p.user.toString() === userIdStr
    );

    if (participantIndex === -1) {
      throw new BadRequestException('User is not a participant in this group order');
    }

    // Sanitize and ensure vendorId & vendorName on each item
    const sanitizedItems = (items || []).map(item => {
      let vId = item.vendorId || (item.vendor?._id || item.vendor);
      if (!vId && groupOrder.vendor) {
        vId = groupOrder.vendor;
      }
      return {
        productId: item.productId ? new Types.ObjectId(item.productId) : undefined,
        vendorId: vId && Types.ObjectId.isValid(vId) ? new Types.ObjectId(vId) : undefined,
        vendorName: item.vendorName || item.vendor?.storeName || undefined,
        name: item.name,
        price: Number(item.price) || 0,
        quantity: Number(item.quantity) || 1,
        customizations: Array.isArray(item.customizations) ? item.customizations : [],
        image: item.image || '',
      };
    });

    // Calculate total for this participant
    const total = sanitizedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    groupOrder.participants[participantIndex].items = sanitizedItems as any;
    groupOrder.participants[participantIndex].total = total;
    groupOrder.participants[participantIndex].isReady = true; // Auto-ready when items are updated from cart

    // Collect all unique vendors across ALL participants in the group order
    const allVendorIds = new Set<string>();
    if (groupOrder.vendor) {
      allVendorIds.add(groupOrder.vendor.toString());
    }
    for (const p of groupOrder.participants) {
      for (const it of (p.items || [])) {
        if (it.vendorId) {
          allVendorIds.add(it.vendorId.toString());
        }
      }
    }
    groupOrder.vendors = Array.from(allVendorIds).map(id => new Types.ObjectId(id)) as any;
    if (!groupOrder.vendor && groupOrder.vendors.length > 0) {
      groupOrder.vendor = groupOrder.vendors[0];
    }
    
    await groupOrder.save();
    
    const populated = await this.findByCode(inviteCode);
    this.gateway.broadcastUpdate(inviteCode, populated);
    this.gateway.broadcastItemsUpdated(inviteCode, { userId: userIdStr, items: sanitizedItems, total });
    
    return populated;
  }

  async toggleReady(userId: string, inviteCode: string, isReady: boolean): Promise<GroupOrder> {
    const groupOrder = await this.groupOrderModel.findOne({ inviteCode });
    if (!groupOrder) throw new NotFoundException('Group order not found');

    const userIdStr = userId.toString();
    const participantIndex = groupOrder.participants.findIndex(
      (p) => p.user && p.user.toString() === userIdStr
    );

    if (participantIndex === -1) {
      throw new BadRequestException('User is not a participant in this group order');
    }

    groupOrder.participants[participantIndex].isReady = isReady;
    await groupOrder.save();
    
    this.gateway.broadcastUpdate(inviteCode, await this.findByCode(inviteCode));
    
    return this.findByCode(inviteCode);
  }

  async updateStatus(hostId: string, inviteCode: string, status: string): Promise<GroupOrder> {
    const groupOrder = await this.groupOrderModel.findOne({ inviteCode });
    if (!groupOrder) throw new NotFoundException('Group order not found');
    
    if (groupOrder.host.toString() !== hostId.toString()) {
      throw new BadRequestException('Only the host can update the group order status');
    }

    groupOrder.status = status;
    await groupOrder.save();
    
    this.gateway.broadcastStatusChanged(inviteCode, status);
    
    return this.findByCode(inviteCode);
  }

  async initiateCheckout(hostId: string, inviteCode: string, splitType: string): Promise<GroupOrder> {
    const rawOrder = await this.groupOrderModel.findOne({ inviteCode });
    if (!rawOrder) throw new NotFoundException('Group order not found');

    if (rawOrder.host.toString() !== hostId.toString()) {
      throw new BadRequestException('Only the host can initiate checkout');
    }

    if (rawOrder.status !== 'open') {
      throw new BadRequestException('Group order must be open to initiate checkout');
    }

    rawOrder.status = 'locked';
    rawOrder.splitType = splitType;
    if (splitType === 'sponsor') {
      rawOrder.sponsorId = hostId as any;
    }
    
    await rawOrder.save();

    const populated = await this.findByCode(inviteCode);
    this.gateway.broadcastStatusChanged(inviteCode, 'locked');
    this.gateway.broadcastUpdate(inviteCode, populated);

    return populated;
  }

  /**
   * The platform's cut on a group order.
   *
   * A group splits one delivery across several participants and often several stores, so one
   * flat per-order fee undercharges the work involved. This reads the admin configuration and
   * returns the fee to add; zero when the admin has switched group fees off.
   */
  private async resolveGroupServiceFee(subtotal: number): Promise<number> {
    try {
      const setting = await this.settingModel.findOne({ key: 'group_orders' }).lean().exec();
      const cfg: any = (setting as any)?.value || {};
      if (cfg.serviceFeeEnabled === false) return 0;

      const type = cfg.serviceFeeType === 'percentage' ? 'percentage' : 'flat';
      const value = Number(cfg.serviceFeeValue ?? 150);
      const min = Number(cfg.minServiceFee ?? 100);
      const raw = type === 'percentage' ? Math.round(subtotal * (value / 100)) : value;
      return Math.max(min, raw);
    } catch {
      return 0;
    }
  }

  async checkout(userId: string, inviteCode: string, paymentReference?: string, guestId?: string, deliveryDetails?: any): Promise<GroupOrder> {
    const rawOrder = await this.groupOrderModel.findOne({ inviteCode }).populate('participants.user', 'firstName lastName email');
    if (!rawOrder) throw new NotFoundException('Group order not found');
    
    if (rawOrder.status !== 'locked' && rawOrder.status !== 'open') {
      throw new BadRequestException('Group order is already completed or cancelled');
    }

    if (!paymentReference || !paymentReference.trim()) {
      throw new BadRequestException('Payment reference is required to checkout a group order. Please complete payment at checkout.');
    }

    // Handle SYSTEM webhook or guest checkout
    const isSystem = userId === 'SYSTEM';
    const sponsorIdStr = (rawOrder.sponsorId || rawOrder.host).toString();
    const effectiveUserId = isSystem ? sponsorIdStr : userId.toString();

    // If splitType is sponsor, only the sponsor can checkout
    if (rawOrder.splitType === 'sponsor' && !isSystem && sponsorIdStr !== effectiveUserId && rawOrder.sponsorId?.toString() !== guestId?.toString()) {
      throw new BadRequestException('Only the sponsor can checkout this group order');
    }

    // Find the participant
    let participantIndex = rawOrder.participants.findIndex(
      (p) => p.user && p.user.toString() === effectiveUserId
    );

    if (participantIndex === -1 && guestId) {
      participantIndex = rawOrder.participants.findIndex(
        (p) => p.user && p.user.toString() === guestId.toString()
      );
      if (participantIndex !== -1) {
        // Migrate the guest ID to the authenticated user ID
        rawOrder.participants[participantIndex].user = new Types.ObjectId(effectiveUserId) as any;
        if (rawOrder.host.toString() === guestId.toString()) {
          rawOrder.host = new Types.ObjectId(effectiveUserId) as any;
        }
        if (rawOrder.sponsorId && rawOrder.sponsorId.toString() === guestId.toString()) {
          rawOrder.sponsorId = new Types.ObjectId(effectiveUserId) as any;
        }
        await rawOrder.save();
      }
    }

    // Handle Payment Verification & Deduction
    if (paymentReference === 'WALLET_PAYMENT') {
      if (rawOrder.splitType === 'sponsor') {
        const grandSubtotal = rawOrder.participants.reduce((sum, p) => sum + (p.total || 0), 0);
        if (grandSubtotal > 0) {
          await this.walletsService.debitWallet(
            sponsorIdStr,
            grandSubtotal,
            `Group Order (${rawOrder.inviteCode}) - Sponsor Checkout`
          );
        }
      } else if (rawOrder.splitType === 'split_bill' && participantIndex !== -1) {
        const myShare = rawOrder.participants[participantIndex].total || 0;
        if (myShare > 0) {
          await this.walletsService.debitWallet(
            effectiveUserId,
            myShare,
            `Group Order (${rawOrder.inviteCode}) - Split Bill Share`
          );
        }
      }
    } else if (!paymentReference.startsWith('TEST_') && !paymentReference.startsWith('GROUP-')) {
      const verification = await this.paystackService.verifyTransaction(paymentReference);
      if (verification?.status !== 'success') {
        throw new BadRequestException('Paystack payment verification failed.');
      }
      if (!deliveryDetails && verification?.data?.metadata) {
        deliveryDetails = verification.data.metadata;
      }
    }

    if (rawOrder.splitType === 'split_bill') {
      if (participantIndex === -1) {
        throw new BadRequestException('You are not a participant in this group order');
      }
      if (rawOrder.participants[participantIndex].items.length === 0) {
        throw new BadRequestException('Your cart is empty');
      }
      // Mark as paid
      rawOrder.participants[participantIndex].hasPaid = true;
      await rawOrder.save();
      
      const updatedOrder = await this.findByCode(inviteCode);
      this.gateway.broadcastUpdate(inviteCode, updatedOrder);
      this.gateway.broadcastPaymentProgress(inviteCode, updatedOrder);

      // Check if all active participants have paid
      const activeParticipants = rawOrder.participants.filter(p => p.items.length > 0);
      const allPaid = activeParticipants.every(p => p.hasPaid);

      if (!allPaid) {
        return updatedOrder; // Return early, don't finalize yet
      }
    } else {
      // If sponsor, mark everyone as paid
      rawOrder.participants.forEach(p => {
        if (p.items.length > 0) p.hasPaid = true;
      });
    }

    // If we reach here, either it's sponsor, or split_bill and everyone has paid.
    // Convert into real Orders — grouped by vendorId!
    const readyParticipants = rawOrder.participants.filter(p => p.items && p.items.length > 0);
    const createdOrderIds: Types.ObjectId[] = [];
    
    // Group participants' items by vendorId
    const vendorMap = new Map<string, { vendorId: string, packs: any[] }>();

    readyParticipants.forEach((participant, pIdx) => {
      let participantName = `Participant ${pIdx + 1}`;
      if (participant.user && (participant.user as any).firstName) {
        participantName = `${(participant.user as any).firstName} ${(participant.user as any).lastName || ''}`.trim();
      }

      participant.items.forEach(item => {
        const vId = (item.vendorId || rawOrder.vendor)?.toString();
        if (!vId) return;

        if (!vendorMap.has(vId)) {
          vendorMap.set(vId, { vendorId: vId, packs: [] });
        }

        const entry = vendorMap.get(vId)!;
        let pack = entry.packs.find(p => p.participantId === participant.user?.toString());
        if (!pack) {
          pack = {
            participantId: participant.user?.toString(),
            packId: `group_pack_${pIdx + 1}`,
            name: participantName,
            items: [],
          };
          entry.packs.push(pack);
        }

        pack.items.push({
          productId: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          customizations: item.customizations || [],
          subtotal: item.price * item.quantity,
        });
      });
    });

    // One group fee per store, not per participant: the platform does the same work whether
    // one person ordered from that store or five.
    const groupFeePerVendor = await this.resolveGroupServiceFee(
      readyParticipants.reduce((sum, p) => sum + (Number(p.total) || 0), 0),
    );

    // Create an order for each distinct vendor
    for (const [vId, { packs }] of vendorMap.entries()) {
      if (packs.length > 0) {
        const cleanPacks = packs.map(p => ({
          packId: p.packId,
          name: p.name,
          items: p.items,
        }));

        const orderData = {
          vendorId: vId,
          packs: cleanPacks,
          deliveryOption: deliveryDetails?.deliveryOption || 'use_an_errander',
          deliveryMode: deliveryDetails?.deliveryMode || 'room_delivery',
          recipientName: deliveryDetails?.recipientName || (rawOrder.host as any)?.firstName || 'Group Host',
          recipientPhone: deliveryDetails?.recipientPhone || (rawOrder.host as any)?.phone || '',
          deliveryAddress: deliveryDetails?.specificAddress || deliveryDetails?.deliveryAddress || 'Campus Delivery',
          specificAddress: deliveryDetails?.specificAddress || deliveryDetails?.deliveryAddress || 'Campus Delivery',
          deliveryLocation: deliveryDetails?.deliveryLocation,
          paymentReference: paymentReference || `GROUP-${rawOrder.inviteCode}-${vId.slice(-4)}`,
          groupId: rawOrder._id.toString(),
          isGroupOrder: true,
          serviceFee: groupFeePerVendor,
        };

        try {
          const order = await this.ordersService.create(
            rawOrder.host.toString(),
            orderData,
            undefined,
            { trustedUnpaid: true }
          );
          createdOrderIds.push(order._id as Types.ObjectId);
        } catch (err: any) {
          this.logger.error(`Failed to create order for vendor ${vId} in group order ${rawOrder.inviteCode}: ${err.message}`, err.stack);
        }
      }
    }

    rawOrder.status = 'completed';
    rawOrder.orders = createdOrderIds;
    await rawOrder.save();

    const populated = await this.findByCode(inviteCode);
    this.gateway.broadcastStatusChanged(inviteCode, 'completed');
    this.gateway.broadcastUpdate(inviteCode, populated);

    return populated;
  }

  async delete(hostId: string, inviteCode: string): Promise<void> {
    const groupOrder = await this.groupOrderModel.findOne({ inviteCode });
    if (!groupOrder) throw new NotFoundException('Group order not found');
    
    if (groupOrder.host.toString() !== hostId.toString()) {
      throw new BadRequestException('Only the host can cancel the group order');
    }

    await this.groupOrderModel.deleteOne({ inviteCode });
    this.gateway.broadcastStatusChanged(inviteCode, 'cancelled');
  }
}
