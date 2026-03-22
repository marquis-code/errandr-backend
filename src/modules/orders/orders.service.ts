import {
  Injectable, NotFoundException, BadRequestException, Inject, forwardRef
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Order, OrderStatus, PaymentStatus } from './schemas/order.schema';
import { Vendor, VendorStatus } from '../vendors/schemas/vendor.schema';
import { Errander, ErranderStatus } from '../errandr/schemas/errander.schema';
import { RedisService } from '../redis/redis.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { WalletsService } from '../wallets/wallets.service';
import { EmailService } from '../email/email.service';
import { KorapayService } from '../payments/korapay.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(Vendor.name) private vendorModel: Model<Vendor>,
    @InjectModel(Errander.name) private erranderModel: Model<Errander>,
    private redisService: RedisService,
    @InjectQueue('orders') private orderQueue: Queue,
    @Inject(forwardRef(() => WalletsService)) private walletsService: WalletsService,
    private emailService: EmailService,
    @Inject(forwardRef(() => KorapayService)) private korapayService: KorapayService,
  ) {}

  async create(customerId: string, data: any): Promise<Order> {
    if (data.type === 'custom_errand') {
      const total = data.total || 450;
      const order = await this.orderModel.create({
        orderNumber: `EXT-${uuidv4().slice(0, 8).toUpperCase()}`,
        uniqueCode: Math.floor(100000 + Math.random() * 900000).toString(),
        customer: new Types.ObjectId(customerId),
        type: 'custom_errand',
        customDetails: {
          pickupLocation: data.pickupLocation,
          dropoffLocation: data.dropoffLocation,
          description: data.description,
        },
        subtotal: 0,
        deliveryFee: total,
        serviceFee: 0,
        total,
        statusHistory: [
          { status: OrderStatus.PENDING, timestamp: new Date(), note: 'Custom errand initiated' },
        ],
      });
      await this.broadcastToErrandr(order);
      return order.populate('customer', 'firstName lastName phone avatar');
    }

    // Validate vendor is online and approved
    const vendor = await this.vendorModel.findById(data.vendorId);
    if (!vendor) throw new NotFoundException('Vendor not found');
    if (vendor.status !== VendorStatus.APPROVED) {
      throw new BadRequestException('Vendor is not approved');
    }

    // Calculate totals from packs or items
    let subtotal = 0;
    if (data.packs && data.packs.length > 0) {
      subtotal = data.packs.reduce((packSum: number, pack: any) =>
        packSum + pack.items.reduce((itemSum: number, item: any) => itemSum + (item.subtotal || item.price * item.quantity), 0),
        0,
      );
    } else if (data.items) {
      subtotal = data.items.reduce(
        (sum: number, item: any) => sum + item.subtotal,
        0,
      );
    }

    // Delivery fee based on option
    const deliveryOption = data.deliveryOption || 'use_an_errander';
    let deliveryFee = 0;
    if (deliveryOption === 'use_an_errander') {
      deliveryFee = vendor.deliveryFee || 100;
      const weight = data.weight || 1;
      if (weight > 2) {
        deliveryFee += (weight - 2) * 50;
      }
    }

    let groupDiscount = 0;
    if (data.groupId) {
      const groupOrdersCount = await this.orderModel.countDocuments({ groupId: data.groupId });
      if (groupOrdersCount > 0) {
        groupDiscount = Math.round(deliveryFee * 0.3);
        deliveryFee -= groupDiscount;
      }
    }

    const serviceFee = Math.round(subtotal * 0.05); // 5% service fee
    const packagingFee = vendor.packagingFee ?? 300;
    const total = subtotal + deliveryFee + serviceFee + packagingFee;

    // KORAPAY VERIFICATION
    if (data.paymentReference) {
      const verification = await this.korapayService.verifyCharge(data.paymentReference);
      if (verification?.status !== 'success') {
        throw new BadRequestException('Payment verification failed');
      }
      if (Math.round(verification.amount) < total) {
         throw new BadRequestException('Payment amount mismatch');
      }
    }

    // Build items from packs for backward compatibility
    const flatItems = data.packs
      ? data.packs.flatMap((pack: any) => pack.items.map((item: any) => ({
          product: item.productId || item.product,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          customizations: item.customizations || [],
          subtotal: item.subtotal || item.price * item.quantity,
        })))
      : data.items || [];

    const order = await this.orderModel.create({
      orderNumber: `ERR-${uuidv4().slice(0, 8).toUpperCase()}`,
      uniqueCode: Math.floor(100000 + Math.random() * 900000).toString(),
      customer: new Types.ObjectId(customerId),
      vendor: new Types.ObjectId(data.vendorId),
      items: flatItems,
      packs: data.packs || [],
      subtotal,
      deliveryFee,
      serviceFee,
      packagingFee,
      total,
      weight: data.weight || 1,
      deliveryOption,
      recipientName: data.recipientName || '',
      recipientPhone: data.recipientPhone || '',
      specificAddress: data.specificAddress || '',
      groupId: data.groupId,
      isGroupOrder: !!data.groupId,
      groupDiscount,
      deliveryAddress: data.deliveryAddress || data.specificAddress || '',
      deliveryLocation: data.deliveryLocation,
      deliveryNotes: data.deliveryNotes,
      statusHistory: [
        { status: OrderStatus.PENDING, timestamp: new Date(), note: 'Order placed' },
      ],
      isPreOrder: data.isPreOrder || false,
      scheduledTime: data.scheduledTime || null,
    });

    // Cache order for real-time updates
    await this.redisService.setJSON(
      `order:${order._id}`,
      { status: order.status, vendorId: data.vendorId },
      3600,
    );

    // Schedule background jobs
    if (order.isPreOrder && order.scheduledTime) {
      const delay = new Date(order.scheduledTime).getTime() - Date.now() - 30 * 60000; // 30 mins before
      if (delay > 0) {
        await this.orderQueue.add('processPreOrder', { orderId: order._id }, { delay });
      }
    }

    // Schedule timeout check (e.g. 5 mins)
    await this.orderQueue.add('orderTimeout', { orderId: order._id }, { delay: 300000 });

    // Broadcast to available errandr
    await this.broadcastToErrandr(order);

    // Notify Student
    if (order.customer && (order.customer as any).email) {
      this.emailService.sendOrderConfirmation(
        (order.customer as any).email,
        order.orderNumber,
        order.total,
      );
    }

    return order.populate([
      { path: 'customer', select: 'firstName lastName phone avatar' },
      { path: 'vendor', select: 'storeName logo phone' },
    ]);
  }

  /**
   * Smart Order Broadcast Algorithm:
   * 1. Find available errandr near the vendor location
   * 2. Sort by distance and rating
   * 3. Assign to the closest, highest-rated available errander
   * 4. If no errander available, mark as broadcast and retry via cron
   */
  private async broadcastToErrandr(order: Order): Promise<void> {
    if (order.type === 'custom_errand') {
       // Broadcast custom errands based on pickup location coordinates if available
       // For now, broadcast to all since we don't have coords for arbitrary strings yet
       const errandr = await this.erranderModel.find({ status: ErranderStatus.AVAILABLE });
       if (errandr.length > 0) {
         await this.redisService.publish('order:new', {
           orderId: order._id,
           vendorName: 'CUSTOM LOGISTICS',
           deliveryLocation: order.deliveryLocation,
           total: order.total,
           erranderIds: errandr.map((e) => e.user.toString()),
         });
       }
       return;
    }
    const vendor = await this.vendorModel.findById(order.vendor);
    if (!vendor || !vendor.location?.coordinates) return;

    const [lng, lat] = vendor.location.coordinates;

    // Find available errandr nearby using Redis geo
    const nearbyErranderIds = await this.redisService.georadius(
      'errandr:locations',
      lng,
      lat,
      5,
      'km',
    );

    if (nearbyErranderIds.length > 0) {
      // Get available errandr and sort by rating
      const errandr = await this.erranderModel
        .find({
          user: { $in: nearbyErranderIds.map((id) => new Types.ObjectId(id)) },
          status: ErranderStatus.AVAILABLE,
        })
        .sort({ rating: -1 });

      if (errandr.length > 0) {
        // Publish to Redis channel for real-time notification
        await this.redisService.publish('order:new', {
          orderId: order._id,
          vendorName: vendor.storeName,
          vendorLocation: vendor.location,
          deliveryLocation: order.deliveryLocation,
          total: order.total,
          erranderIds: errandr.map((e) => e.user.toString()),
        });
        return;
      }
    }

    // Mark for retry if no errandr found
    order.isBroadcasted = true;
    order.broadcastAttempts += 1;
    await order.save();
  }

  async updateStatus(
    orderId: string,
    status: OrderStatus,
    userId: string,
    note?: string,
  ): Promise<Order> {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    order.status = status;
    order.statusHistory.push({
      status,
      timestamp: new Date(),
      note: note || `Status changed to ${status}`,
    });

    if (status === OrderStatus.DELIVERED) {
      order.actualDeliveryTime = new Date();
      await this.processPayout(order);
    }

    // Aggressive Notifications
    const populated = await order.populate([
      { path: 'customer', select: 'email' },
      { path: 'vendor', select: 'email storeName' },
      { path: 'errander', select: 'email firstName' },
    ]);

    if (populated.customer && (populated.customer as any).email) {
      this.emailService.sendOrderStatusUpdate(
        (populated.customer as any).email,
        order.orderNumber,
        status,
        note,
      );
    }
    
    // Notify Vendor if cancelled
    if (status === OrderStatus.CANCELLED && populated.vendor && (populated.vendor as any).email) {
      this.emailService.sendOrderStatusUpdate(
        (populated.vendor as any).email,
        order.orderNumber,
        'CANCELLED',
        note,
      );
    }

    await order.save();

    // Update Redis cache
    await this.redisService.setJSON(
      `order:${orderId}`,
      { status, updatedAt: new Date() },
      3600,
    );

    // Publish status update for real-time tracking
    await this.redisService.publish('order:status', {
      orderId,
      status,
      updatedBy: userId,
      timestamp: new Date(),
    });

    return order.populate([
      { path: 'customer', select: 'firstName lastName phone avatar' },
      { path: 'vendor', select: 'storeName logo phone' },
      { path: 'errander', select: 'firstName lastName phone avatar' },
    ]);
  }

  async acceptOrder(orderId: string, erranderId: string): Promise<Order> {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.errander) throw new BadRequestException('Order already accepted');

    // Find errander profile
    const errander = await this.erranderModel.findOne({
      user: new Types.ObjectId(erranderId),
    });
    if (!errander) throw new NotFoundException('Errander profile not found');

    order.errander = new Types.ObjectId(erranderId);
    order.status = OrderStatus.CONFIRMED;
    order.statusHistory.push({
      status: OrderStatus.CONFIRMED,
      timestamp: new Date(),
      note: 'Order accepted by errander',
    });
    await order.save();

    // Update errander status
    errander.status = ErranderStatus.BUSY;
    errander.currentOrder = order._id as Types.ObjectId;
    await errander.save();

    // Publish acceptance
    await this.redisService.publish('order:accepted', {
      orderId,
      erranderId,
      timestamp: new Date(),
    });

    // REAL-TIME VENDOR PAYOUT
    // Vendor gets paid once they accept as per user requirement
    const platformCommissionRate = 0.05;
    const vendorEarnings = Math.round(order.subtotal * (1 - platformCommissionRate));
    
    const populatedVendor = await this.vendorModel.findById(order.vendor);
    if (populatedVendor && populatedVendor.owner) {
      await this.walletsService.creditWallet(
        populatedVendor.owner.toString(),
        vendorEarnings,
        `Payment for order ${order.orderNumber} (Accepted by vendor)`,
        order._id.toString(),
      );
    }

    return order.populate([
      { path: 'customer', select: 'firstName lastName phone avatar' },
      { path: 'vendor', select: 'storeName logo phone' },
      { path: 'errander', select: 'firstName lastName phone avatar' },
    ]);
  }

  async completeOrder(orderId: string, erranderId: string, verificationCode: string): Promise<Order> {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    
    // Security check: only assigned errander can complete
    if (order.errander?.toString() !== erranderId) {
      throw new BadRequestException('You are not assigned to this order');
    }

    // Verify code
    if (order.uniqueCode !== verificationCode.toUpperCase()) {
      throw new BadRequestException('Invalid unique code provided by student');
    }

    order.status = OrderStatus.DELIVERED;
    order.actualDeliveryTime = new Date();
    order.statusHistory.push({
      status: OrderStatus.DELIVERED,
      timestamp: new Date(),
      note: 'Order completed via verification code',
    });

    // ERRANDER PAYOUT
    const erranderEarnings = order.deliveryFee;
    await this.walletsService.creditWallet(
      erranderId,
      erranderEarnings,
      `Delivery earnings for order ${order.orderNumber}`,
      order._id.toString(),
    );

    // Free up errander
    await this.erranderModel.updateOne(
      { user: new Types.ObjectId(erranderId) },
      { status: ErranderStatus.AVAILABLE, $unset: { currentOrder: 1 } },
    );

    await order.save();
    
    // Notifications... (inherited from updateStatus logic)
    await this.redisService.publish('order:status', {
      orderId,
      status: OrderStatus.DELIVERED,
      updatedBy: erranderId,
      timestamp: new Date(),
    });

    return order.populate([
      { path: 'customer', select: 'firstName lastName phone avatar' },
      { path: 'vendor', select: 'storeName logo phone' },
      { path: 'errander', select: 'firstName lastName phone avatar' },
    ]);
  }

  async getCustomerOrders(customerId: string, page: any = 1, limit: any = 20) {
    const p = Math.max(1, parseInt(page) || 1);
    const l = Math.max(1, parseInt(limit) || 20);
    const skip = (p - 1) * l;

    const [orders, total] = await Promise.all([
      this.orderModel
        .find({ customer: new Types.ObjectId(customerId) })
        .populate('vendor', 'storeName logo')
        .populate('errander', 'firstName lastName phone avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(l),
      this.orderModel.countDocuments({ customer: new Types.ObjectId(customerId) }),
    ]);
    return { orders, total };
  }

  async getVendorOrders(vendorId: string, status?: OrderStatus, page: any = 1, limit: any = 20) {
    if (!Types.ObjectId.isValid(vendorId)) {
      return { orders: [], total: 0 };
    }
    const filter: any = { vendor: new Types.ObjectId(vendorId) };
    if (status) filter.status = status;

    const p = Math.max(1, parseInt(page) || 1);
    const l = Math.max(1, parseInt(limit) || 20);
    const skip = (p - 1) * l;

    const [orders, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .populate('customer', 'firstName lastName phone avatar')
        .populate('errander', 'firstName lastName phone avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(l),
      this.orderModel.countDocuments(filter),
    ]);
    return { orders, total };
  }

  async findByVendorOwner(ownerId: string, status?: OrderStatus, page = 1, limit = 10): Promise<{ orders: Order[]; total: number }> {
    const ownerObjId = typeof ownerId === 'string' ? new Types.ObjectId(ownerId) : ownerId;
    const vendor = await this.vendorModel.findOne({ owner: ownerObjId });
    if (!vendor) return { orders: [], total: 0 };
    return this.getVendorOrders(vendor._id.toString(), status, page, limit);
  }

  async getErranderOrders(erranderId: string) {
    return this.orderModel
      .find({ errander: new Types.ObjectId(erranderId) })
      .populate('vendor', 'storeName logo address location')
      .populate('customer', 'firstName lastName phone avatar deliveryAddress location')
      .sort({ createdAt: -1 });
  }

  async getAvailableOrders() {
    return this.orderModel
      .find({
        status: OrderStatus.PENDING,
        errander: { $exists: false },
      })
      .populate('vendor', 'storeName logo address location')
      .populate('customer', 'firstName lastName deliveryAddress location')
      .sort({ createdAt: -1 });
  }

  async findById(id: string): Promise<Order> {
    const order = await this.orderModel
      .findById(id)
      .populate('customer', 'firstName lastName phone avatar deliveryAddress location')
      .populate('vendor', 'storeName logo phone address location user')
      .populate('errander', 'firstName lastName phone avatar user');
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private async processPayout(order: Order): Promise<void> {
    // Populate correctly if not already
    const fullOrder = await this.orderModel.findById(order._id)
      .populate('vendor', 'user')
      .populate('errander', 'user');

    if (!fullOrder) return;

    // Financial Split:
    // 1. Vendor gets Subtotal - Platform Commission (e.g. 5%)
    // 2. Errander gets 100% of Delivery Fee + Tips
    // 3. Platform gets Commission + Service Fee

    const platformCommissionRate = 0.05;
    const vendorEarnings = Math.round(fullOrder.subtotal * (1 - platformCommissionRate));
    const erranderEarnings = fullOrder.deliveryFee + (fullOrder as any).tips || 0;
    
    // Credit Vendor
    if (fullOrder.vendor && (fullOrder.vendor as any).user) {
      await this.walletsService.creditWallet(
        (fullOrder.vendor as any).user.toString(),
        vendorEarnings,
        `Earnings from order ${fullOrder.orderNumber}`,
        fullOrder._id.toString(),
      );
    }

    // Credit Errander
    if (fullOrder.errander && (fullOrder.errander as any).user) {
      await this.walletsService.creditWallet(
        (fullOrder.errander as any).user.toString(),
        erranderEarnings,
        `Delivery fee from order ${fullOrder.orderNumber}`,
        fullOrder._id.toString(),
      );
    }

    // Log for business (can be extended to a business wallet)
  }

  async rateOrder(orderId: string, rating: number, review: string): Promise<Order> {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    order.rating = rating;
    order.review = review;
    await order.save();
    return order;
  }

  async getStats() {
    const [totalOrders, activeOrders, completedOrders, totalRevenue] =
      await Promise.all([
        this.orderModel.countDocuments(),
        this.orderModel.countDocuments({
          status: {
            $in: [
              OrderStatus.PENDING,
              OrderStatus.CONFIRMED,
              OrderStatus.PREPARING,
              OrderStatus.READY_FOR_PICKUP,
              OrderStatus.PICKED_UP,
              OrderStatus.IN_TRANSIT,
            ],
          },
        }),
        this.orderModel.countDocuments({ status: OrderStatus.DELIVERED }),
        this.orderModel.aggregate([
          { $match: { status: OrderStatus.DELIVERED } },
          { $group: { _id: null, total: { $sum: '$total' } } },
        ]),
      ]);

    return {
      totalOrders,
      activeOrders,
      completedOrders,
      totalRevenue: totalRevenue[0]?.total || 0,
    };
  }

  async reorder(orderId: string, customerId: string): Promise<Order> {
    const originalOrder = await this.orderModel.findById(orderId);
    if (!originalOrder) throw new NotFoundException('Original order not found');

    const orderData = {
      vendorId: originalOrder.vendor.toString(),
      items: originalOrder.items.map((item) => ({
        product: item.product,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        customizations: item.customizations,
        subtotal: item.subtotal,
      })),
      deliveryAddress: originalOrder.deliveryAddress,
      deliveryLocation: originalOrder.deliveryLocation,
      deliveryNotes: originalOrder.deliveryNotes,
      isReorder: true,
      originalOrderId: originalOrder._id,
    };

    return this.create(customerId, orderData);
  }


  async cancelOrder(orderId: string, userId: string, reason: string): Promise<Order> {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    const allowedStatuses = [OrderStatus.PENDING, OrderStatus.CONFIRMED];
    if (!allowedStatuses.includes(order.status)) {
      throw new BadRequestException('Order cannot be cancelled at this stage');
    }

    order.status = OrderStatus.CANCELLED;
    order.cancelReason = reason;
    order.cancelledBy = new Types.ObjectId(userId);
    order.statusHistory.push({
      status: OrderStatus.CANCELLED,
      timestamp: new Date(),
      note: `Order cancelled: ${reason}`,
    });

    if (order.errander) {
      await this.erranderModel.updateOne(
        { user: order.errander },
        { status: ErranderStatus.AVAILABLE, $unset: { currentOrder: 1 } },
      );
    }

    await order.save();
    await this.redisService.publish('order:cancelled', { orderId, userId, reason });

    return order;
  }
}
