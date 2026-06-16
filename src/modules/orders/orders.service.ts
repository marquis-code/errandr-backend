import {
  Injectable, NotFoundException, BadRequestException, Inject, forwardRef, Logger
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Order, OrderStatus, PaymentStatus, OrderType } from './schemas/order.schema';

import { Vendor, VendorStatus } from '../vendors/schemas/vendor.schema';
import { Errander, ErranderStatus } from '../erranders/schemas/errander.schema';
import { Product } from '../products/schemas/product.schema';
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
import { RewardsService } from '../rewards/rewards.service';
import { AfricasTalkingService } from '../africastalking/africastalking.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(Vendor.name) private vendorModel: Model<Vendor>,
    @InjectModel(Errander.name) private erranderModel: Model<Errander>,
    @InjectModel(Product.name) private productModel: Model<Product>,
    private redisService: RedisService,
    @InjectQueue('orders') private orderQueue: Queue,
    @Inject(forwardRef(() => WalletsService)) private walletsService: WalletsService,
    private emailService: EmailService,
    @Inject(forwardRef(() => PaystackService)) private paystackService: PaystackService,
    private notificationsService: NotificationsService,
    private notificationsGateway: NotificationsGateway,
    private chatService: ChatService,
    private batchDeliveryService: BatchDeliveryService,
    private rewardsService: RewardsService,
    @Inject(forwardRef(() => AfricasTalkingService))
    private africasTalkingService: AfricasTalkingService,
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

    // Broadcast via Redis to all backend instances (Render compatibility)
    await this.notificationsService.broadcastNewOrder(orderData);
    this.logger.log(`Broadcasted order ${populated.orderNumber} to all erranders via Redis`);
  }


  async create(customerId: string, data: any): Promise<Order> {
    if (data.type === 'custom_errand') {
      const runnerFee = Number(data.runnerFee);
      if (!runnerFee || runnerFee <= 0) {
        throw new BadRequestException('Runner fee must be greater than 0');
      }

      const itemCost = Number(data.estimatedItemCost) || 0;
      // Flat Buyer's Convenience Fee
      const serviceFee = 50; 
      // Total ONLY includes runner fee + service fee (Model A)
      const total = runnerFee + serviceFee;

      // Commission from Runner (Primary Model)
      const commissionAmount = Math.round(runnerFee * 0.10); // 10%
      const erranderShare = runnerFee - commissionAmount;
      const platformShare = serviceFee + commissionAmount;

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
        subtotal: itemCost, // Reference only
        deliveryFee: runnerFee,
        serviceFee,
        erranderShare,
        platformShare,
        total,
        paymentStatus: PaymentStatus.PENDING,
        status: OrderStatus.PENDING,
        statusHistory: [
          { status: OrderStatus.PENDING, timestamp: new Date(), note: 'Custom errand created, pending errander acceptance' },
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
      // Get all product images for items
      const productIds = data.items.map((i: any) => new Types.ObjectId(i.productId || i.product));
      const products = await this.productModel.find({ _id: { $in: productIds } });
      const imageMap = products.reduce((acc, p) => {
        acc[p._id.toString()] = p.image || p.images?.[0];
        return acc;
      }, {});

      subtotal = data.items.reduce(
        (sum: number, item: any) => {
          item.image = imageMap[item.productId || item.product];
          return sum + item.subtotal;
        },
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

    // Dorm Delivery (Social Savings) logic
    if (data.isDormDelivery) {
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
      const hostOrder = await this.orderModel.findOne({
        deliveryAddress: data.deliveryAddress || data.specificAddress,
        createdAt: { $gte: fifteenMinsAgo },
        status: { $in: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PREPARING] }
      });
      if (hostOrder) {
        // Shared delivery: 50% discount
        groupDiscount += Math.round(deliveryFee * 0.5);
        deliveryFee = Math.max(0, deliveryFee - Math.round(deliveryFee * 0.5));
      }
    }

    // Mystery Box logic
    let mysteryProduct: any = null;
    if (data.isMysteryBox) {
      const highValueProducts = await this.productModel.find({ 
        vendor: new Types.ObjectId(data.vendorId),
        price: { $gt: 1200 },
        isAvailable: true 
      });
      
      if (highValueProducts.length > 0) {
        mysteryProduct = highValueProducts[Math.floor(Math.random() * highValueProducts.length)];
        subtotal = 800; // Fixed price for Mystery Box
      } else {
        // Fallback to normal if no high value products found
        data.isMysteryBox = false;
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
    let flatItems = data.packs
      ? data.packs.flatMap((pack: any) => pack.items.map((item: any) => ({
          product: item.productId || item.product,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          customizations: item.customizations || [],
          subtotal: item.subtotal || item.price * item.quantity,
        })))
      : data.items || [];

    // Overwrite items if Mystery Box
    if (data.isMysteryBox && mysteryProduct) {
      flatItems = [{
        product: mysteryProduct._id,
        name: `Mystery Box: ${mysteryProduct.name}`,
        price: mysteryProduct.price,
        quantity: 1,
        customizations: [],
        subtotal: 800,
      }];
    }

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
      isMysteryBox: !!data.isMysteryBox,
      isDormDelivery: !!data.isDormDelivery,
      groupDiscount,
      deliveryAddress: data.deliveryAddress || data.specificAddress || '',
      deliveryLocation: data.deliveryLocation,
      deliveryNotes: data.deliveryNotes,
      paymentStatus: data.paymentReference ? PaymentStatus.PAID : PaymentStatus.PENDING,
      paymentReference: data.paymentReference || null,
      status: data.paymentReference ? OrderStatus.CONFIRMED : OrderStatus.AWAITING_PAYMENT,
      statusHistory: [
        { 
          status: data.paymentReference ? OrderStatus.CONFIRMED : OrderStatus.AWAITING_PAYMENT, 
          timestamp: new Date(), 
          note: data.paymentReference ? 'Order placed and payment confirmed' : 'Order placed, awaiting payment' 
        },
      ],
      isPreOrder: data.isPreOrder || false,
      scheduledTime: data.scheduledTime || null,
    });

    // Reward for Clear Instructions (Compliance)
    if (order.deliveryNotes || order.deliveryLocation) {
      await this.rewardsService.updateUserStats(customerId, { clearInstructions: true });
      await this.rewardsService.addPoints(customerId, 10, 'Bonus mapping: Clear delivery instructions provided');
    }

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

    // Broadcast to available erranders
    await this.broadcastNewOrderToErranders(order);


    // Trigger Vendor Notification Cascade
    const populatedVendor = await this.vendorModel.findById(data.vendorId).populate('owner');
    if (populatedVendor) {
      // Fire-and-forget cascade
      this.notificationsService.notifyVendor(populatedVendor, order).catch(e => {
        this.logger.error(`Vendor notification cascade failed: ${e.message}`);
      });
    }

    if (order.customer && (order.customer as any).email) {
      if (order.paymentStatus === PaymentStatus.PAID) {
        this.emailService.sendPaymentReceipt(
          (order.customer as any).email,
          order.total,
          order.orderNumber,
          (order as any).paymentMethod || 'card',
        );
      }
      
      this.emailService.sendOrderConfirmation(
        (order.customer as any).email,
        order,
      );
    }

    // TRIGGER AUTOMATED VOICE CALL TO VENDOR
    if (order.paymentStatus === PaymentStatus.PAID && populatedVendor?.phone) {
      try {
        const itemsList = order.items.map(i => `${i.quantity} ${i.name}`);
        await this.africasTalkingService.sendOrderDispatchCall(populatedVendor.phone, {
          orderNumber: order.orderNumber,
          orderId: (order._id as any).toString(),
          items: itemsList,
          total: order.total
        });
        this.logger.log(`Triggered automated order dispatch call for order ${order.orderNumber} to ${populatedVendor.phone}`);
      } catch (e) {
        this.logger.error(`Failed to trigger dispatch call: ${e.message}`);
      }
    }

    return order.populate([
      { path: 'customer', select: 'firstName lastName phone avatar' },
      { path: 'vendor', select: 'storeName logo phone' },
    ]);
  }

  /**
   * Smart Order Broadcast Algorithm:
   * 1. Find available erranders near the vendor location
   * 2. Sort by distance and rating
   * 3. Assign to the closest, highest-rated available errander
   * 4. If no errander available, mark as broadcast and retry via cron
   */
  private async broadcastToErranders(order: Order): Promise<void> {
    if (order.type === 'custom_errand') {
       // Broadcast custom errands based on pickup location coordinates if available
       // For now, broadcast to all since we don't have coords for arbitrary strings yet
       const erranders = await this.erranderModel.find({ status: ErranderStatus.AVAILABLE });
       if (erranders.length > 0) {
         await this.redisService.publish('order:new', {
           orderId: order._id,
           vendorName: 'CUSTOM LOGISTICS',
           deliveryLocation: order.deliveryLocation,
           total: order.total,
           erranderIds: erranders.map((e) => e.user.toString()),
         });
       }
       return;
    }
    const vendor = await this.vendorModel.findById(order.vendor);
    if (!vendor || !vendor.location?.coordinates) return;

    const [lng, lat] = vendor.location.coordinates;

    // Find available erranders nearby using Redis geo
    const nearbyErranderIds = await this.redisService.georadius(
      'erranders:locations',
      lng,
      lat,
      5,
      'km',
    );

    if (nearbyErranderIds.length > 0) {
      // Get available erranders and sort by rating
      const erranders = await this.erranderModel
        .find({
          user: { $in: nearbyErranderIds.map((id) => new Types.ObjectId(id)) },
          status: ErranderStatus.AVAILABLE,
        })
        .sort({ rating: -1 });

      if (erranders.length > 0) {
        // Publish to Redis channel for real-time notification
        await this.redisService.publish('order:new', {
          orderId: order._id,
          vendorName: vendor.storeName,
          vendorLocation: vendor.location,
          deliveryLocation: order.deliveryLocation,
          total: order.total,
          erranderIds: erranders.map((e) => e.user.toString()),
        });
        return;
      }
    }

    // Mark for retry if no erranders found
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

    // Aggressive Notifications & Status Checks
    const populated = await order.populate([
      { path: 'customer', select: 'email firstName' },
      { path: 'vendor', select: 'email storeName' },
      { path: 'errander', select: 'email firstName' },
    ]);

    if (status === OrderStatus.DELIVERED) {
      order.actualDeliveryTime = new Date();
      await this.processPayout(order);

      // Trigger engagement updates
      if (order.customer) {
        await this.rewardsService.updateUserStats(order.customer.toString(), { orders: 1, streak: true });
      }
      if (order.errander) {
        // Find owner user ID from errander profile
        const errander = await this.erranderModel.findById(order.errander);
        if (errander) {
          await this.rewardsService.updateUserStats(errander.user.toString(), { deliveries: 1 });
        }
      }
      
      // Detailed Delivery Email with Summary
      if (populated.customer && (populated.customer as any).email) {
        this.emailService.sendOrderDelivered((populated.customer as any).email, populated);
      }
    }

    if (populated.customer && (populated.customer as any).email) {
      // Send receipt and confirmation if moving to CONFIRMED
      if (status === OrderStatus.CONFIRMED) {
        try {
          await this.emailService.sendPaymentReceipt(
            (populated.customer as any).email,
            order.total,
            order.orderNumber,
            (order as any).paymentMethod || 'card'
          );
          await this.emailService.sendOrderConfirmation(
            (populated.customer as any).email,
            populated
          );
        } catch (e) {
          this.logger.error(`Failed to send confirmation emails for order ${orderId}: ${e.message}`);
        }
      } else {
        this.emailService.sendOrderStatusUpdate(
          (populated.customer as any).email,
          order.orderNumber,
          status,
          note,
        );
      }
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
    const isBatchActive = await this.batchDeliveryService.isWindowActive();
    const maxOrders = isBatchActive ? 5 : 1;

    // Find errander profile, or auto-create if they just signed up and haven't fetched profile
    let errander = await this.erranderModel.findOne({
      user: new Types.ObjectId(erranderId),
    });
    
    if (!errander) {
      errander = await this.erranderModel.create({
        user: new Types.ObjectId(erranderId),
        status: ErranderStatus.OFFLINE,
      });
    }

    // Check current load
    const currentActiveCount = (errander.batchOrders?.length || 0) + (errander.currentOrder ? 1 : 0);
    if (currentActiveCount >= maxOrders) {
      throw new BadRequestException(
        isBatchActive 
          ? `You have reached the maximum number of concurrent orders (${maxOrders}) for this batch window.`
          : 'You already have an active order. Complete it before accepting another.'
      );
    }

    // ATOMIC UPDATE: Only update if no errander is assigned yet and status is PENDING
    const order = await this.orderModel.findOneAndUpdate(
      { 
        _id: new Types.ObjectId(orderId), 
        errander: { $exists: false },
        status: OrderStatus.PENDING 
      },
      {
        $set: {
          errander: new Types.ObjectId(erranderId),
          status: OrderStatus.CONFIRMED,
        },
        $push: {
          statusHistory: {
            status: OrderStatus.CONFIRMED,
            timestamp: new Date(),
            note: isBatchActive ? 'Order accepted as part of Batch Delivery' : 'Order accepted by errander',
          } as any
        }
      },
      { new: true }
    );

    if (!order) {
      throw new BadRequestException('Order already accepted by another rider or is no longer available');
    }

    // Get the errander's user profile for details
    const erranderUser = await this.orderModel.db
      .collection('users')
      .findOne({ _id: new Types.ObjectId(erranderId) });

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

    // Reward for Fast Acceptance (Compliance)
    const orderCreatedAt = (order as any).createdAt || new Date();
    const acceptanceDelay = (Date.now() - new Date(orderCreatedAt).getTime()) / 60000; // in minutes
    if (acceptanceDelay <= 3) {
      await this.rewardsService.updateUserStats(errander.user.toString(), { fastAccept: true });
      await this.rewardsService.addPoints(errander.user.toString(), 30, 'Compliance: Lightning-fast order acceptance (within 3 mins)');
    }

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

    // Award Points for Order Completion
    await this.rewardsService.addPoints(order.customer.toString(), 25, `Completed order #${order.orderNumber}`);
    
    // Reward for Fast Delivery (Compliance)
    const pickupEvent = order.statusHistory.find(h => h.status === OrderStatus.PICKED_UP);
    if (pickupEvent) {
      const deliveryDuration = (Date.now() - new Date(pickupEvent.timestamp).getTime()) / 60000;
      if (deliveryDuration <= 15) {
        await this.rewardsService.updateUserStats(erranderId, { fastDelivery: true });
        await this.rewardsService.addPoints(erranderId, 50, 'Compliance: Super-fast delivery (within 15 mins of pickup)');
      }
    }

    // Reward for Erranders Consistency
    await this.rewardsService.addPoints(erranderId, 20, `Successful delivery of order #${order.orderNumber}`);

    // Batch Hero Bonus
    if (order.groupId) {
       await this.rewardsService.addPoints(erranderId, 15, 'Efficiency bonus: Successful Group Order delivery');
    }

    await order.save();
    
    // Notify all
    await this.notifyOrderStatusUpdate(order, OrderStatus.DELIVERED, 'Order delivered successfully');

    // Re-trigger Detailed Delivery Email if not already sent by updateStatus (idempotency)
    const fullyPopulatedCustomer = await order.populate('customer', 'firstName email');
    if (fullyPopulatedCustomer.customer && (fullyPopulatedCustomer.customer as any).email) {
      this.emailService.sendOrderDelivered((fullyPopulatedCustomer.customer as any).email, {
        customerName: (fullyPopulatedCustomer.customer as any).firstName,
        orderNumber: order.orderNumber,
        total: order.total,
        items: order.items,
        id: order._id
      });
    }

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
      .populate('errander', 'firstName lastName phone avatar user')
      .populate('bids.errander', 'firstName lastName avatar phone');
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

  async rateOrder(
    orderId: string, 
    data: { 
      vendorRating?: number; 
      vendorReview?: string; 
      erranderRating?: number; 
      erranderReview?: string; 
    }
  ): Promise<Order> {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    
    if (data.vendorRating) {
      order.vendorRating = data.vendorRating;
      order.vendorReview = data.vendorReview || '';
      order.hasRatedVendor = true;
    }

    if (data.erranderRating) {
      order.erranderRating = data.erranderRating;
      order.erranderReview = data.erranderReview || '';
      order.hasRatedErrander = true;
      
      // Award points to Erranders for good rating
      if (data.erranderRating >= 4 && order.errander) {
        await this.rewardsService.updateUserStats(order.errander.toString(), { perfectRating: data.erranderRating === 5 });
        await this.rewardsService.addPoints(order.errander.toString(), data.erranderRating === 5 ? 50 : 20, `${data.erranderRating}-star rating bonus (Compliance)`);
      }
    }

    // Award Points to Customer for rating
    const ratingDelay = (Date.now() - new Date(order.actualDeliveryTime).getTime()) / 60000; // minutes
    let pointReward = 20;
    if (ratingDelay <= 30) {
      pointReward += 30; // Promptness bonus!
      await this.rewardsService.updateUserStats(order.customer.toString(), { promptRating: true });
      await this.rewardsService.addPoints(order.customer.toString(), pointReward, `Compliance: Prompt 5-star rating bonus (within 30 mins)`);
    } else {
      await this.rewardsService.addPoints(order.customer.toString(), pointReward, `Rated order #${order.orderNumber}`);
    }

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

    // Refund if paid
    if (order.paymentStatus === PaymentStatus.PAID) {
      await this.walletsService.creditWallet(
        order.customer.toString(),
        order.total,
        `Refund for cancelled order #${order.orderNumber}`,
        order._id.toString()
      );
      order.paymentStatus = PaymentStatus.REFUNDED;
    }

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
    await this.notifyOrderStatusUpdate(order, OrderStatus.CANCELLED, `Cancelled by customer: ${reason}`);

    return order.populate([
      { path: 'customer', select: 'firstName lastName phone avatar' },
      { path: 'vendor', select: 'storeName logo phone' },
    ]);
  }

  async payWithWallet(orderId: string, customerId: string): Promise<Order> {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    
    if (order.customer.toString() !== customerId) {
      throw new BadRequestException('Unauthorized');
    }
    
    if (order.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException('Order already paid');
    }
    
    // Debit wallet
    try {
      await this.walletsService.debitWallet(
        customerId,
        order.total,
        `Payment for order #${order.orderNumber}`
      );
    } catch (e: any) {
      throw new BadRequestException(e.message || 'Payment failed');
    }
    
    order.paymentStatus = PaymentStatus.PAID;
    order.status = OrderStatus.CONFIRMED;
    order.statusHistory.push({
      status: OrderStatus.CONFIRMED,
      timestamp: new Date(),
      note: 'Order paid via wallet balance',
    });
    
    await order.save();
    
    // Broadcast
    await this.broadcastNewOrderToErranders(order);
    
    return order.populate([
      { path: 'customer', select: 'firstName lastName phone avatar' },
      { path: 'vendor', select: 'storeName logo phone' },
    ]);
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

  async verifyOtp(orderId: string, otp: string, type: 'pickup' | 'delivery'): Promise<boolean> {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    const expectedHash = type === 'pickup' ? (order as any).pickupOtpHash : order.deliveryOtpHash;
    if (!expectedHash) return true;

    const isMatch = await bcrypt.compare(otp, expectedHash);
    if (!isMatch) throw new BadRequestException(`Invalid ${type} OTP`);
    return true;
  }

  async generateAndSendOtp(
    orderId: string, 
    type: 'pickup' | 'delivery', 
    userId?: string
  ): Promise<{ success: boolean; message: string; method: string }> {
    const order = await this.orderModel.findById(orderId).populate('customer');
    if (!order) throw new NotFoundException('Order not found');

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hash = await bcrypt.hash(otp, 10);

    let method = 'sms';

    if (type === 'pickup') {
      (order as any).pickupOtpHash = hash;
      const vendor = await this.vendorModel.findById(order.vendor).populate('owner');
      if (vendor && (vendor.owner as any)?.phone) {
        const phone = (vendor.owner as any).phone;
        const smsSent = await this.africasTalkingService.sendSMS(phone, `Erranders Pickup Code for #${order.orderNumber}: ${otp}`);
        if (!smsSent) {
          this.logger.warn(`SMS failed for pickup OTP to ${phone}, falling back to voice call`);
          await this.africasTalkingService.sendVoiceOTP(phone, otp);
          method = 'voice';
        }
      }
    } else {
      order.deliveryOtpHash = hash;
      const customer = order.customer as any;
      if (customer && customer.phone) {
        const smsSent = await this.africasTalkingService.sendSMSOTP(customer.phone, otp);
        if (!smsSent) {
          this.logger.warn(`SMS failed for delivery OTP to ${customer.phone}, falling back to voice call`);
          await this.africasTalkingService.sendVoiceOTP(customer.phone, otp);
          method = 'voice';
        }
      }
    }

    await order.save();
    return { 
      success: true, 
      message: method === 'voice' ? 'SMS failing, initiated voice call fallback' : 'OTP sent via SMS',
      method 
    };
  }

  async resendOtpWithVoice(
    orderId: string, 
    type: 'pickup' | 'delivery',
    userId?: string
  ): Promise<{ success: boolean; message: string; method: string }> {
    const order = await this.orderModel.findById(orderId).populate('customer');
    if (!order) throw new NotFoundException('Order not found');

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hash = await bcrypt.hash(otp, 10);

    let phone = '';
    if (type === 'pickup') {
      (order as any).pickupOtpHash = hash;
      const vendor = await this.vendorModel.findById(order.vendor).populate('owner');
      phone = (vendor?.owner as any)?.phone;
    } else {
      order.deliveryOtpHash = hash;
      phone = (order.customer as any)?.phone;
    }

    if (!phone) throw new BadRequestException('Recipient phone number not found');

    await order.save();
    await this.africasTalkingService.sendVoiceOTP(phone, otp);
    
    return { 
      success: true, 
      message: 'Voice call initiated',
      method: 'voice' 
    };
  }

  async trackOrder(orderNumber: string, email: string) {
    const order = await this.orderModel.findOne({ orderNumber })
      .populate('vendor', 'storeName businessType businessName address logo')
      .populate('customer', 'firstName lastName email phone')
      .populate('errander', 'firstName lastName phone avatar vehicleType')
      .populate('items.product', 'name images')
      .populate('packs.items.product', 'name images');
    
    if (!order) throw new NotFoundException('Order not found');

    const customerEmail = (order.customer as any)?.email;

    if (customerEmail !== email) {
      throw new BadRequestException('Invalid email for this order number');
    }

    return order;
  }

  async cancelTrackedOrder(orderNumber: string, email: string) {
    const order = await this.trackOrder(orderNumber, email);

    const cancellableStatuses = [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.AWAITING_PAYMENT];
    if (!cancellableStatuses.includes(order.status)) {
      throw new BadRequestException(`Cannot cancel order that is already ${order.status}`);
    }

    order.status = OrderStatus.CANCELLED;
    order.cancelReason = 'Cancelled by customer via tracking portal';
    order.statusHistory.push({
      status: OrderStatus.CANCELLED,
      timestamp: new Date(),
      note: 'Cancelled by customer via tracking portal'
    });

    await order.save();

    if (order.vendor) {
      this.notifyOrderStatusUpdate(order, OrderStatus.CANCELLED, 'Order was cancelled by the customer.');
    }

    return { success: true, message: 'Order cancelled successfully', order };
  }

  async acceptCustomErrand(orderId: string, erranderId: string): Promise<Order> {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.type !== OrderType.CUSTOM_ERRAND) {
      throw new BadRequestException('Only custom errands can use this endpoint');
    }
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Order is no longer available');
    }

    // Find errander profile, or auto-create if they just signed up
    let errander = await this.erranderModel.findOne({
      user: new Types.ObjectId(erranderId),
    });
    
    if (!errander) {
      errander = await this.erranderModel.create({
        user: new Types.ObjectId(erranderId),
        status: ErranderStatus.OFFLINE,
      });
    }

    order.errander = new Types.ObjectId(erranderId);
    order.status = OrderStatus.AWAITING_PAYMENT;
    order.statusHistory.push({
      status: OrderStatus.AWAITING_PAYMENT,
      timestamp: new Date(),
      note: 'Errander accepted, awaiting student payment'
    });
    
    await order.save();

    await this.notificationsService.sendNotification(order.customer.toString(), {
      title: 'Errand Accepted!',
      body: 'A rider has accepted your errand. Please make payment to confirm and open chat.',
      type: 'ORDER_AWAITING_PAYMENT',
      data: { orderId: order._id.toString() },
    });

    return order;
  }

  async payForCustomErrand(orderId: string, customerId: string, paymentReference: string): Promise<Order> {
    const order = await this.orderModel.findById(orderId).populate('errander');
    if (!order) throw new NotFoundException('Order not found');
    if (order.customer.toString() !== customerId) throw new BadRequestException('Not your order');
    if (order.status !== OrderStatus.AWAITING_PAYMENT) {
      throw new BadRequestException('Order is not awaiting payment');
    }

    const verification = await this.paystackService.verifyTransaction(paymentReference);
    if (verification?.status !== 'success') {
      throw new BadRequestException('Payment verification failed');
    }
    if (Math.round(verification.amount) < order.total) {
      throw new BadRequestException('Payment amount mismatch');
    }

    order.paymentReference = paymentReference;
    order.paymentStatus = PaymentStatus.PAID;
    order.status = OrderStatus.CONFIRMED;
    order.statusHistory.push({
      status: OrderStatus.CONFIRMED,
      timestamp: new Date(),
      note: 'Payment verified, order confirmed'
    });

    await order.save();

    // Auto-create initial chat message for the order
    try {
      const erranderUser: any = order.errander;
      if (erranderUser) {
        await this.chatService.createMessage({
          orderId: order._id.toString(),
          senderId: erranderUser._id.toString(),
          receiverId: customerId,
          message: `Hi! I'm ${erranderUser.firstName || 'your rider'} and I've locked in your custom errand #${order.orderNumber}. Let's discuss! 🚀`,
          messageType: 'text',
        });
      }
    } catch (err) {
      this.logger.error('Failed to auto-create initial chat message for custom errand:', err);
    }

    await this.notificationsService.sendNotification(order.errander.toString(), {
      title: 'Payment Confirmed!',
      body: `Customer has paid for Order #${order.orderNumber}. You can now start the errand!`,
      type: 'ORDER_CONFIRMED',
      data: { orderId: order._id.toString() },
    });

    return order;
  }

  async updateErrandFee(orderId: string, customerId: string, newFee: number): Promise<Order> {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.customer.toString() !== customerId.toString()) throw new BadRequestException('Not your order');
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Cannot increase fee after acceptance');
    }
    if (newFee <= order.deliveryFee) {
      throw new BadRequestException('New fee must be higher than current fee');
    }

    const serviceFee = 50; 
    const total = newFee + serviceFee;
    const commissionAmount = Math.round(newFee * 0.10); 
    const erranderShare = newFee - commissionAmount;
    const platformShare = serviceFee + commissionAmount;

    order.deliveryFee = newFee;
    order.erranderShare = erranderShare;
    order.platformShare = platformShare;
    order.total = total;
    
    await order.save();

    await this.broadcastNewOrderToErranders(order);
    return order;
  }

  async placeBid(orderId: string, erranderId: string, amount: number): Promise<Order> {
    const order = await this.orderModel.findById(orderId).populate('bids.errander');
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== OrderStatus.PENDING) throw new BadRequestException('Order is no longer pending');

    // check if this errander already bid
    const existingBidIndex = order.bids.findIndex(b => b.errander._id.toString() === erranderId.toString() && b.status === 'pending');
    if (existingBidIndex >= 0) {
      // update bid
      order.bids[existingBidIndex].amount = amount;
      order.bids[existingBidIndex].timestamp = new Date();
    } else {
      order.bids.push({
        errander: new Types.ObjectId(erranderId),
        amount,
        status: 'pending',
        timestamp: new Date()
      });
    }

    await order.save();
    const populatedOrder = await this.orderModel.findById(order._id).populate('bids.errander');

    await this.notificationsService.sendNotification(order.customer.toString(), {
      title: 'New Bid Received',
      body: `A rider has proposed a counter-offer of ₦${amount} for your errand.`,
      type: 'ORDER_BIDS_UPDATE',
      data: { orderId: order._id.toString(), order: populatedOrder },
    });

    return populatedOrder as Order;
  }

  async rejectBid(orderId: string, bidId: string, customerId: string): Promise<Order> {
    const order = await this.orderModel.findById(orderId).populate('bids.errander');
    if (!order) throw new NotFoundException('Order not found');
    if (order.customer.toString() !== customerId.toString()) throw new BadRequestException('Not your order');

    const bid = order.bids.find(b => b._id.toString() === bidId);
    if (!bid) throw new NotFoundException('Bid not found');
    if (bid.status !== 'pending') throw new BadRequestException('Bid is not pending');

    bid.status = 'rejected';
    await order.save();

    const populatedOrder = await this.orderModel.findById(order._id).populate('bids.errander');

    // Notify the errander that their bid was rejected
    if (bid.errander) {
      await this.notificationsService.sendNotification(bid.errander._id.toString(), {
        title: 'Offer Declined',
        body: `Your offer of ₦${bid.amount} was declined by the student.`,
        type: 'ORDER_BIDS_UPDATE',
        data: { orderId: order._id.toString() },
      });
    }

    return populatedOrder as Order;
  }

  async acceptBid(orderId: string, bidId: string, customerId: string): Promise<Order> {
    const order = await this.orderModel.findById(orderId).populate('bids.errander');
    if (!order) throw new NotFoundException('Order not found');
    if (order.customer.toString() !== customerId.toString()) throw new BadRequestException('Not your order');
    if (order.status !== OrderStatus.PENDING) throw new BadRequestException('Order is no longer pending');

    const bid = order.bids.find(b => b._id.toString() === bidId);
    if (!bid) throw new NotFoundException('Bid not found');
    if (bid.status !== 'pending') throw new BadRequestException('Bid is not pending');

    // Mark this bid as accepted, others rejected
    order.bids.forEach(b => {
      if (b._id.toString() === bidId) b.status = 'accepted';
      else b.status = 'rejected';
    });

    const newFee = bid.amount;
    const serviceFee = 50; 
    const total = newFee + serviceFee;
    const commissionAmount = Math.round(newFee * 0.10); 
    const erranderShare = newFee - commissionAmount;
    const platformShare = serviceFee + commissionAmount;

    order.deliveryFee = newFee;
    order.erranderShare = erranderShare;
    order.platformShare = platformShare;
    order.total = total;

    // Assign the errander
    let errander = await this.erranderModel.findOne({ user: bid.errander._id });
    if (!errander) {
      errander = await this.erranderModel.create({
        user: bid.errander._id,
        status: 'OFFLINE',
      });
    }

    order.errander = bid.errander._id;
    order.status = OrderStatus.AWAITING_PAYMENT;
    order.statusHistory.push({
      status: OrderStatus.AWAITING_PAYMENT,
      timestamp: new Date(),
      note: 'Customer accepted a counter-offer bid, awaiting payment'
    });

    await order.save();
    
    const populatedOrder = await this.orderModel.findById(order._id)
      .populate('customer', 'firstName lastName email phone avatar')
      .populate('errander', 'firstName lastName phone avatar vehicleType');

    // Notify the accepted errander
    await this.notificationsService.sendNotification(bid.errander._id.toString(), {
      title: 'Bid Accepted!',
      body: `Your counter-offer for Order #${order.orderNumber} was accepted!`,
      type: 'ORDER_BID_ACCEPTED',
      data: { orderId: order._id.toString() },
    });

    // Notify customer to refresh
    await this.notificationsService.sendNotification(order.customer.toString(), {
      title: 'Errand Accepted!',
      body: 'You have accepted a bid. Please make payment to confirm and open chat.',
      type: 'ORDER_ACCEPTED',
      data: { orderId: order._id.toString(), order: populatedOrder },
    });

    return populatedOrder as Order;
  }
}
