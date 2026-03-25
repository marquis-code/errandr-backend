import {
  Injectable, NotFoundException, BadRequestException, Inject, forwardRef, Logger
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Order, OrderStatus, PaymentStatus, OrderType } from './schemas/order.schema';

import { Vendor, VendorStatus } from '../vendors/schemas/vendor.schema';
import { Errander, ErranderStatus } from '../errandr/schemas/errander.schema';
import { RedisService } from '../redis/redis.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { WalletsService } from '../wallets/wallets.service';
import { EmailService } from '../email/email.service';
import { PaystackService } from '../payments/paystack.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { ChatService } from '../chat/chat.service';
import { BatchDeliveryService } from './batch-delivery.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(Vendor.name) private vendorModel: Model<Vendor>,
    @InjectModel(Errander.name) private erranderModel: Model<Errander>,
    private redisService: RedisService,
    @InjectQueue('orders') private orderQueue: Queue,
    @Inject(forwardRef(() => WalletsService)) private walletsService: WalletsService,
    private emailService: EmailService,
    @Inject(forwardRef(() => PaystackService)) private paystackService: PaystackService,
    private notificationsService: NotificationsService,
    private notificationsGateway: NotificationsGateway,
    private chatService: ChatService,
    private batchDeliveryService: BatchDeliveryService,
  ) {}

  async getBatchStatus() {
    return this.batchDeliveryService.getBatchStatus();
  }

  private async notifyOrderStatusUpdate(order: any, status: OrderStatus, note?: string) {
    const title = 'Order Update';
    const body = `Your order #${order.orderNumber} is now ${status.replace(/_/g, ' ').toLowerCase()}`;
    
    const customerId = order.customer?._id || order.customer;
    const erranderId = order.errander?._id || order.errander;
    const vendorOwnerId = order.vendor?.owner?._id || order.vendor?.owner;

    const statusData = { orderId: order._id, status, orderNumber: order.orderNumber };

    // Notify Customer (stored + real-time)
    if (customerId) {
      await this.notificationsService.sendNotification(customerId.toString(), {
        title, body, type: 'ORDER_STATUS_UPDATE', data: statusData,
      });
      this.notificationsGateway.sendOrderStatusUpdate(customerId.toString(), {
        title, body, ...statusData,
      });
    }

    // Notify Errander if assigned (stored + real-time)
    if (erranderId) {
      const erranderBody = `Order #${order.orderNumber} status changed to ${status.replace(/_/g, ' ').toLowerCase()}`;
      await this.notificationsService.sendNotification(erranderId.toString(), {
        title: 'Delivery Update', body: erranderBody, type: 'ORDER_STATUS_UPDATE', data: statusData,
      });
      this.notificationsGateway.sendOrderStatusUpdate(erranderId.toString(), {
        title: 'Delivery Update', body: erranderBody, ...statusData,
      });
    }

    // Notify Vendor Owner (stored + real-time)
    if (vendorOwnerId) {
      await this.notificationsService.sendOrderStatusToVendor(
        vendorOwnerId.toString(), order, status,
      );
      this.notificationsGateway.sendOrderStatusUpdate(vendorOwnerId.toString(), {
        title: '📦 Order Update',
        body: `Order #${order.orderNumber} is now ${status.replace(/_/g, ' ')}`,
        ...statusData,
      });
    }
  }

  /**
   * Broadcast a new paid order to ALL connected erranders so they can accept it.
   */
  async broadcastNewOrderToErranders(order: any): Promise<void> {
    const populated = await this.orderModel.findById(order._id)
      .populate('vendor', 'storeName logo address location')
      .populate('customer', 'firstName lastName deliveryAddress');
    
    if (!populated) return;

    let vendorName = 'Store';
    let vendorAddress = 'N/A';
    
    if (populated.type === OrderType.CUSTOM_ERRAND) {
      vendorName = 'CUSTOM ERRAND';
      vendorAddress = populated.customDetails?.pickupLocation || 'Custom Pickup';
    } else {
      vendorName = (populated.vendor as any)?.storeName || 'Store';
      vendorAddress = (populated.vendor as any)?.address || 'N/A';
    }
    
    const orderData = {
      orderId: populated._id,
      orderNumber: populated.orderNumber,
      vendorName,
      vendorLogo: (populated.vendor as any)?.logo,
      vendorAddress,
      customerName: `${(populated.customer as any)?.firstName || ''} ${(populated.customer as any)?.lastName || ''}`.trim(),
      deliveryAddress: populated.deliveryAddress || (populated.customer as any)?.deliveryAddress || 'N/A',
      items: populated.items?.map(i => ({ name: i.name, qty: i.quantity, price: i.price })) || [],
      itemCount: populated.items?.length || 0,
      subtotal: populated.subtotal,
      deliveryFee: populated.deliveryFee,
      total: populated.total,
      erranderShare: populated.erranderShare || populated.deliveryFee || 0,
      status: populated.status,
      type: populated.type,
      createdAt: (populated as any).createdAt,
    };

    // Broadcast via gateway to ALL connected clients
    this.notificationsGateway.broadcastNewOrder(orderData);
    // Also persist via Redis broadcast channel
    await this.notificationsService.broadcastNewOrder(orderData);
    this.logger.log(`Broadcasted order ${populated.orderNumber} to all erranders`);
  }


  async create(customerId: string, data: any): Promise<Order> {
    if (data.type === 'custom_errand') {
      const baseFee = data.urgency === 'express' ? 850 : 450;
      const itemCost = Number(data.estimatedItemCost) || 0;
      const serviceFee = Math.round((baseFee + itemCost) * 0.05); // 5% service fee
      const total = baseFee + itemCost + serviceFee;

      // PAYSTACK VERIFICATION for Custom Errands
      if (data.paymentReference) {
        const verification = await this.paystackService.verifyTransaction(data.paymentReference);
        if (verification?.status !== 'success') {
          throw new BadRequestException('Payment verification failed');
        }
        if (Math.round(verification.amount) < total) {
           throw new BadRequestException('Payment amount mismatch');
        }
      } else {
        throw new BadRequestException('Payment reference is required for custom errands');
      }

      const order = await this.orderModel.create({
        orderNumber: `EXT-${uuidv4().slice(0, 8).toUpperCase()}`,
        uniqueCode: Math.floor(100000 + Math.random() * 900000).toString(),
        customer: new Types.ObjectId(customerId),
        type: OrderType.CUSTOM_ERRAND,
        customDetails: {
          pickupLocation: data.pickupLocation,
          dropoffLocation: data.dropoffLocation,
          description: data.description,
          estimatedItemCost: itemCost,
          urgency: data.urgency || 'standard',
        },
        subtotal: itemCost,
        deliveryFee: baseFee,
        serviceFee,
        total,
        paymentStatus: PaymentStatus.PAID,
        paymentReference: data.paymentReference,
        status: OrderStatus.PENDING,
        statusHistory: [
          { status: OrderStatus.PENDING, timestamp: new Date(), note: 'Custom errand paid and initiated' },
        ],
      });
      await this.broadcastNewOrderToErranders(order);

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
    
    // Batch Delivery logic for delivery fee or grouping
    const isBatchActive = await this.batchDeliveryService.isWindowActive();
    
    // New Packaging Packs logic
    let packagingFee = vendor.packagingFee ?? 300;
    let selectedPackData = null;
    
    if (data.selectedPack && data.selectedPack.name) {
      packagingFee = data.selectedPack.price ?? vendor.packagingFee ?? 300;
      selectedPackData = data.selectedPack;
    }

    const total = subtotal + deliveryFee + serviceFee + packagingFee;

    // PAYSTACK VERIFICATION
    if (data.paymentReference) {
      const verification = await this.paystackService.verifyTransaction(data.paymentReference);
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
      selectedPack: selectedPackData,
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
      paymentStatus: data.paymentReference ? PaymentStatus.PAID : PaymentStatus.PENDING,
      paymentReference: data.paymentReference || null,
      status: data.paymentReference ? OrderStatus.CONFIRMED : OrderStatus.PENDING,
      statusHistory: [
        { 
          status: data.paymentReference ? OrderStatus.CONFIRMED : OrderStatus.PENDING, 
          timestamp: new Date(), 
          note: data.paymentReference ? 'Order placed and payment confirmed' : 'Order placed' 
        },
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
    await this.broadcastNewOrderToErranders(order);


    // Notify Vendor (Real-time alert)
    const populatedVendor = await this.vendorModel.findById(data.vendorId).select('owner');
    if (populatedVendor?.owner) {
      await this.notificationsService.sendNotification(populatedVendor.owner.toString(), {
        title: 'New Order',
        body: `You have a new order #${order.orderNumber}`,
        type: 'NEW_ORDER',
        data: { orderId: order._id, orderNumber: order.orderNumber }
      });
    }

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

    // Real-time WebSocket Notification
    await this.notifyOrderStatusUpdate(populated, status, note);

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
    if (order.errander) throw new BadRequestException('Order already accepted by another rider');

    // Find errander profile
    const errander = await this.erranderModel.findOne({
      user: new Types.ObjectId(erranderId),
    });
    if (!errander) throw new NotFoundException('Errander profile not found');

    const isBatchActive = await this.batchDeliveryService.isWindowActive();
    const maxOrders = isBatchActive ? 5 : 1;

    // Check current load
    const currentActiveCount = (errander.batchOrders?.length || 0) + (errander.currentOrder ? 1 : 0);
    if (currentActiveCount >= maxOrders) {
      throw new BadRequestException(
        isBatchActive 
          ? `You have reached the maximum number of concurrent orders (${maxOrders}) for this batch window.`
          : 'You already have an active order. Complete it before accepting another.'
      );
    }

    // Get the errander's user profile for details
    const erranderUser = await this.orderModel.db
      .collection('users')
      .findOne({ _id: new Types.ObjectId(erranderId) });

    order.errander = new Types.ObjectId(erranderId);
    order.status = OrderStatus.CONFIRMED;
    order.statusHistory.push({
      status: OrderStatus.CONFIRMED,
      timestamp: new Date(),
      note: isBatchActive ? 'Order accepted as part of Batch Delivery' : 'Order accepted by errander',
    });
    await order.save();

    // Update errander status and batch list
    errander.status = ErranderStatus.BUSY;
    if (isBatchActive) {
      if (!errander.batchOrders) errander.batchOrders = [];
      errander.batchOrders.push(order._id as Types.ObjectId);
    } else {
      errander.currentOrder = order._id as Types.ObjectId;
    }
    await errander.save();

    // Notify all parties via stored notifications + real-time
    await this.notifyOrderStatusUpdate(order, OrderStatus.CONFIRMED, 'Order accepted by errander');

    // Send specific ORDER_ACCEPTED notification to customer with errander details
    const customerId = order.customer?._id || order.customer;
    if (customerId && erranderUser) {
      await this.notificationsService.sendOrderAccepted(
        customerId.toString(),
        order,
        erranderUser,
      );
      this.notificationsGateway.sendOrderAccepted(customerId.toString(), {
        orderId: order._id,
        orderNumber: order.orderNumber,
        errander: {
          id: erranderUser._id,
          firstName: erranderUser.firstName,
          lastName: erranderUser.lastName,
          phone: erranderUser.phone,
          avatar: erranderUser.avatar,
        },
      });
    }

    // Auto-create initial chat message for the order
    try {
      await this.chatService.createMessage({
        orderId: order._id.toString(),
        senderId: erranderId,
        receiverId: customerId?.toString() || '',
        message: `Hi! I'm ${erranderUser?.firstName || 'your rider'} and I've accepted your order #${order.orderNumber}. I'll be picking it up shortly! 🚀`,
        messageType: 'text',
      });
      this.logger.log(`Auto-created chat message for order ${order.orderNumber}`);
    } catch (e) {
      this.logger.warn(`Failed to auto-create chat for order ${order.orderNumber}: ${e}`);
    }

    // REAL-TIME VENDOR PAYOUT
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
    const orderErranderId = (order.errander as any)?._id?.toString() || order.errander?.toString();
    this.logger.log(`completeOrder check: order.errander=${orderErranderId} vs erranderId=${erranderId.toString()}`);
    
    if (orderErranderId !== erranderId.toString()) {
      this.logger.error(`Assignment mismatch: ${orderErranderId} !== ${erranderId.toString()}`);
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

    // Free up errander or update batch
    const errander = await this.erranderModel.findOne({ user: new Types.ObjectId(erranderId) });
    if (errander) {
      if (errander.currentOrder?.toString() === orderId) {
        (errander as any).currentOrder = null;
      }
      errander.batchOrders = errander.batchOrders?.filter(id => id.toString() !== orderId) || [];
      
      if (!errander.currentOrder && (!errander.batchOrders || errander.batchOrders.length === 0)) {
        errander.status = ErranderStatus.AVAILABLE;
      }
      await errander.save();
    }

    await order.save();
    
    // Notify all
    await this.notifyOrderStatusUpdate(order, OrderStatus.DELIVERED, 'Order delivered successfully');

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

  async findByVendorOwner(ownerId: string, status?: OrderStatus, page = 1, limit = 10, vendorId?: string): Promise<{ orders: Order[]; total: number }> {
    this.logger.log(`findByVendorOwner() ownerId=${ownerId} status=${status} vendorId=${vendorId} page=${page} limit=${limit}`);

    if (vendorId) {
      this.logger.log(`findByVendorOwner() Direct vendor lookup for vendorId=${vendorId}`);
      return this.getVendorOrders(vendorId, status, page, limit);
    }

    try {
      const ownerObjId = typeof ownerId === 'string' ? new Types.ObjectId(ownerId) : ownerId;
      const vendors = await this.vendorModel.find({ owner: ownerObjId });
      this.logger.log(`findByVendorOwner() found ${vendors.length} vendors for ownerId=${ownerId}`);
      
      if (!vendors.length) {
        this.logger.warn(`findByVendorOwner() NO VENDORS FOUND for ownerId=${ownerId}`);
        return { orders: [], total: 0 };
      }
      
      const vendorIds = vendors.map(v => v._id);
      this.logger.log(`findByVendorOwner() found vendorIds=[${vendorIds.join(', ')}]`);
      
      const filter: any = { vendor: { $in: vendorIds } };
      if (status) filter.status = status;

      const p = Math.max(1, Number(page) || 1);
      const l = Math.max(1, Number(limit) || 10);
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

      this.logger.log(`findByVendorOwner() returning ${orders.length} orders. Total=${total}`);
      return { orders, total };
    } catch (error: any) {
      this.logger.error(`findByVendorOwner() ERROR: ${error.message}`);
      throw error;
    }
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
      const errander = await this.erranderModel.findOne({ user: order.errander });
      if (errander) {
        if (errander.currentOrder?.toString() === orderId) {
          (errander as any).currentOrder = null;
        }
        errander.batchOrders = errander.batchOrders?.filter(id => id.toString() !== orderId) || [];
        
        if (!errander.currentOrder && (!errander.batchOrders || errander.batchOrders.length === 0)) {
          errander.status = ErranderStatus.AVAILABLE;
        }
        await errander.save();
      }
    }

    await order.save();
    
    // Notify all
    await this.notifyOrderStatusUpdate(order, OrderStatus.CANCELLED, `Order cancelled: ${reason}`);

    return order;
  }

//   async getOrdersForVendorOwner(ownerId: string, status?: OrderStatus, page = 1, limit = 10) {
//   this.logger.log(`getOrdersForVendorOwner() ownerId=${ownerId}`);

//   const vendor = await this.vendorModel.findOne({ owner: new Types.ObjectId(ownerId) });

//   if (!vendor) {
//     throw new NotFoundException('No vendor profile found for this account');
//   }

//   this.logger.log(`getOrdersForVendorOwner() found vendorId=${vendor._id}`);

//   return this.getVendorOrders(vendor._id.toString(), status, page, limit);
// }
async getOrdersForVendorOwner(ownerId: string, status?: OrderStatus, page = 1, limit = 10) {
  this.logger.log(`getOrdersForVendorOwner() ownerId=${ownerId}`);

  const vendor = await this.vendorModel.findOne({ owner: new Types.ObjectId(ownerId) });
  if (!vendor) throw new NotFoundException('No vendor profile found for this account');

  this.logger.log(`getOrdersForVendorOwner() found vendorId=${vendor._id}`);

  // TEMP: raw count - no filters at all
  const rawCount = await this.orderModel.countDocuments({ vendor: vendor._id });
  this.logger.log(`getOrdersForVendorOwner() RAW order count for this vendor = ${rawCount}`);

  // TEMP: check what the most recent orders in DB look like
  const sampleOrders = await this.orderModel.find().limit(3).select('vendor customer status orderNumber');
  this.logger.log(`getOrdersForVendorOwner() sample DB orders = ${JSON.stringify(sampleOrders)}`);

  return this.getVendorOrders(vendor._id.toString(), status, page, limit);
}
}
