import {
  Injectable, NotFoundException, BadRequestException, Inject, forwardRef, Logger, ForbiddenException, InternalServerErrorException
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Order, OrderStatus, PaymentStatus, OrderType, LocationType } from './schemas/order.schema';

import { Vendor, VendorStatus } from '../vendors/schemas/vendor.schema';
import { Errander, ErranderStatus } from '../erranders/schemas/errander.schema';
import { User } from '../users/schemas/user.schema';
import { Product } from '../products/schemas/product.schema';
import { MenuItem } from '../menu/schemas/menu-item.schema';
import { MenuPack } from '../menu/schemas/menu-pack.schema';
import { SystemSetting } from '../admin/schemas/system-setting.schema';
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
import { augmentVendor } from '../../utils/vendor-helpers';
import { RewardsService } from '../rewards/rewards.service';
import { ErrandersService } from '../erranders/erranders.service';
import { MapboxService } from '../mapbox/mapbox.service';
import { PromoCodesService } from '../promo-codes/promo-codes.service';
import * as bcrypt from 'bcryptjs';

import { ModuleRef } from '@nestjs/core';
import { ExamModeService } from '../exam-mode/exam-mode.service';
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(Vendor.name) private vendorModel: Model<Vendor>,
    @InjectModel(Errander.name) private erranderModel: Model<Errander>,
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(MenuItem.name) private menuItemModel: Model<MenuItem>,
    @InjectModel(MenuPack.name) private menuPackModel: Model<MenuPack>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(SystemSetting.name) private settingModel: Model<SystemSetting>,
    @InjectModel('ErrandPool') private errandPoolModel: Model<any>,
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
    private mapboxService: MapboxService,
    private promoCodesService: PromoCodesService,
    private moduleRef: ModuleRef,
    @Inject(forwardRef(() => ErrandersService))
    private errandersService: ErrandersService,
  ) {}

  private get examModeService(): ExamModeService {
    return this.moduleRef.get(ExamModeService, { strict: false });
  }

  /**
   * Retry helper for transient MongoDB errors (ECONNRESET, network timeouts)
   */
  private async withRetry<T>(operation: () => Promise<T>, label: string, maxRetries = 3): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        const isTransient = error?.message?.includes('ECONNRESET') ||
          error?.message?.includes('ETIMEDOUT') ||
          error?.message?.includes('MongoNetworkError') ||
          error?.name === 'MongoNetworkError' ||
          error?.name === 'MongoNetworkTimeoutError';

        if (isTransient && attempt < maxRetries) {
          const delay = attempt * 200;
          this.logger.warn(`[${label}] Transient error (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw new InternalServerErrorException('Max retries exceeded');
  }

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

    // Milestone control: Only send SMS for major order state changes
    const majorStatuses = [
      OrderStatus.CONFIRMED,
      OrderStatus.PICKED_UP,
      OrderStatus.IN_TRANSIT,
      OrderStatus.DELIVERED,
      OrderStatus.CANCELLED
    ];
    const skipSms = !majorStatuses.includes(status);

    // Notify Customer (stored + real-time)
    if (customerId) {
      await this.notificationsService.sendNotification(customerId.toString(), {
        title, body, type: 'ORDER_STATUS_UPDATE', data: statusData, skipSms
      });
      this.notificationsGateway.sendOrderStatusUpdate(customerId.toString(), {
        title, body, ...statusData,
      });
    }

    // Notify Errander if assigned (stored + real-time)
    if (erranderId) {
      const erranderBody = `Order #${order.orderNumber} status changed to ${status.replace(/_/g, ' ').toLowerCase()}`;
      await this.notificationsService.sendNotification(erranderId.toString(), {
        title: 'Delivery Update', body: erranderBody, type: 'ORDER_STATUS_UPDATE', data: statusData, skipSms
      });
      this.notificationsGateway.sendOrderStatusUpdate(erranderId.toString(), {
        title: 'Delivery Update', body: erranderBody, ...statusData,
      });
    }

    // Notify Vendor Owner (stored + real-time)
    if (vendorOwnerId) {
      await this.notificationsService.sendOrderStatusToVendor(
        vendorOwnerId.toString(), order, status, skipSms
      );
      this.notificationsGateway.sendOrderStatusUpdate(vendorOwnerId.toString(), {
        title: '📦 Order Update',
        body: `Order #${order.orderNumber} is now ${status.replace(/_/g, ' ')}`,
        ...statusData,
      });
    }

    // Nudge unassigned erranders if vendor makes progress
    if (!erranderId && order.type !== OrderType.CUSTOM_ERRAND && [OrderStatus.PREPARING, OrderStatus.READY_FOR_PICKUP].includes(status as any)) {
      const isPreparing = status === OrderStatus.PREPARING;
      const creativeBody = isPreparing
        ? `🔥 A vendor just started preparing an order! Accept it now to pick it up exactly when it's hot!`
        : `🚨 An order is ready and waiting at the counter! Quick pickup available, grab it now!`;
        
      await this.redisService.publish('notification:broadcast:erranders', JSON.stringify({
        type: 'NEW_ORDER', // We use NEW_ORDER so the errander app prompts it like a fresh order availability
        title: isPreparing ? 'Hot Order Alert!' : 'Ready for Pickup!',
        body: creativeBody,
        data: { orderId: order._id.toString(), status }
      }));
    }
  }

  /**
   * Broadcast a new paid order to ALL connected erranders so they can accept it.
   */
  async broadcastNewOrderToErranders(order: any): Promise<void> {
    const populated = await this.orderModel.findById(order._id)
      .populate('vendor', 'storeName logo address location')
      .populate('customer', 'firstName lastName deliveryAddress erranderGenderPreference gender');
    
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
      customerGender: (populated.customer as any)?.gender,
      isGroupOrder: populated.isGroupOrder || false,
      deliveryAddress: populated.deliveryAddress || (populated.customer as any)?.deliveryAddress || 'N/A',
      items: populated.items?.map(i => ({ name: i.name, qty: i.quantity, price: i.price })) || [],
      packs: populated.packs?.map(p => ({
        name: p.name,
        items: p.items?.map(i => ({ name: i.name, qty: i.quantity, price: i.price })) || []
      })) || [],
      itemCount: populated.items?.length || 0,
      subtotal: populated.subtotal,
      deliveryFee: populated.deliveryFee,
      total: populated.total,
      erranderPayout: populated.erranderPayout,
      erranderShare: populated.erranderShare || populated.deliveryFee || 0,
      status: populated.status,
      type: populated.type,
      locationType: (populated as any).locationType,
      proposedDeliveryFee: (populated as any).proposedDeliveryFee,
      createdAt: (populated as any).createdAt,
    };

    // Broadcast via Redis to all backend instances (Render compatibility)
    await this.notificationsService.broadcastNewOrder(orderData);
    this.logger.log(`Broadcasted order ${populated.orderNumber} to all erranders via Redis`);

    // Aggressively send loud push notifications to erranders based on gender preference
    try {
      const availableErranders = await this.erranderModel.find({ status: ErranderStatus.AVAILABLE }).populate('user', 'fcmToken phone gender');
      
      const preference = (populated.customer as any)?.erranderGenderPreference || 'Both';
      let filteredErranders = availableErranders;
      
      if (preference !== 'Both' && preference !== 'Any') {
         filteredErranders = availableErranders.filter(e => {
            const gender = (e.user as any)?.gender;
            return gender && gender.toLowerCase() === preference.toLowerCase();
         });
         
         if (filteredErranders.length === 0) {
            this.logger.warn(`No available erranders matching gender preference '${preference}', falling back to all available erranders.`);
            filteredErranders = availableErranders;
         }
      }

      for (const e of filteredErranders) {
        if (e.user) {
          const userObj = e.user as any;
          const feeDisplay = orderData.type === 'custom_errand' ? (orderData.deliveryFee || 0) : 300;
          
          if (userObj.fcmToken) {
            await this.notificationsService.sendPushNotification(userObj.fcmToken, {
              title: '🚨 NEW ERRAND AVAILABLE!',
              body: `An order from ${vendorName} needs a runner right now! ₦${feeDisplay} fee`,
              data: { type: 'NEW_ORDER', orderId: orderData.orderId.toString() },
            });
          }
          if (userObj.phone) {
             await this.notificationsService.sendZavuSMS(userObj.phone, `🚨 NEW ERRAND AVAILABLE! An order from ${vendorName} needs a runner right now! ₦${feeDisplay} fee`);
          }
        }
      }
    } catch (e) {
      this.logger.error(`Failed to push notification to erranders: ${e}`);
    }
  }


  async create(customerId: string, data: any): Promise<Order> {
    if (data.type === 'custom_errand') {
      const runnerFee = Number(data.runnerFee);

      // Fetch minimum runner fee from admin settings
      const errandSetting = await this.settingModel.findOne({ key: 'custom_errand' }).exec();
      const minCustomErrandFee = errandSetting?.value?.minCustomErrandFee ?? 400;
      const commissionPercent = errandSetting?.value?.customErrandCommissionPercentage ?? 20;

      if (!runnerFee || runnerFee < minCustomErrandFee) {
        throw new BadRequestException(`Runner fee must be at least ₦${minCustomErrandFee}`);
      }

      const itemCost = Number(data.estimatedItemCost) || 0;
      // Flat Buyer's Convenience Fee
      const serviceFee = 50; 
      // Paystack transfer fee: ₦10 for ≤₦5,000, ₦25 for >₦5,000 (charged to customer)
      const transferFee = itemCost > 0 ? (itemCost <= 5000 ? 10 : 25) : 0;
      // Total includes EVERYTHING: item cost + runner fee + service fee + transfer fee
      const total = itemCost + runnerFee + serviceFee + transferFee;

      // Commission from Runner (Primary Model)
      const commissionAmount = Math.round(runnerFee * (commissionPercent / 100));
      const erranderShare = runnerFee - commissionAmount;
      const platformShare = serviceFee + commissionAmount;

      // Optional Paystack verification
      let paymentVerified = false;
      if (data.paymentReference) {
        const verification = await this.paystackService.verifyTransaction(data.paymentReference);
        if (verification?.status === 'success' && verification.amount >= total - 5) {
           paymentVerified = true;
        }
      }

      const order = await this.orderModel.create({
        orderNumber: `EXT-${uuidv4().slice(0, 8).toUpperCase()}`,
        uniqueCode: Math.floor(100000 + Math.random() * 900000).toString(),
        deliveryPin: Math.floor(1000 + Math.random() * 9000).toString(),
        customer: new Types.ObjectId(customerId),
        type: OrderType.CUSTOM_ERRAND,
        customDetails: {
          pickupLocation: data.pickupLocation,
          dropoffLocation: data.dropoffLocation,
          description: data.description,
          attachedImage: data.attachedImage,
          attachedVoiceNote: data.attachedVoiceNote,
          estimatedItemCost: itemCost,
          urgency: data.urgency || 'standard',
        },
        subtotal: itemCost,
        deliveryFee: runnerFee,
        serviceFee,
        transferFee,
        erranderShare,
        erranderPayout: erranderShare,
        platformShare,
        total,
        paymentStatus: data.paymentReference ? (paymentVerified ? PaymentStatus.PAID : PaymentStatus.PENDING) : PaymentStatus.PENDING,
        paymentReference: data.paymentReference || undefined,
        status: OrderStatus.PENDING,
        itemCostDisbursementStatus: itemCost > 0 ? 'pending' : 'not_applicable',
        reconciliationStatus: itemCost > 0 ? 'pending' : 'not_applicable',
        statusHistory: [
          { status: OrderStatus.PENDING, timestamp: new Date(), note: 'Custom errand created' },
        ],
      });

      // Only broadcast if payment is guaranteed (already verified or cash)
      if (paymentVerified || data.paymentMethod === 'cash') {
        await this.broadcastNewOrderToErranders(order);
      }

      return order.populate('customer', 'firstName lastName phone avatar');
    }

    // Validate vendor is online and approved
    const vendor = await this.vendorModel.findById(data.vendorId);
    if (!vendor) throw new NotFoundException('Vendor not found');
    if (vendor.status !== VendorStatus.APPROVED) {
      throw new BadRequestException('Vendor is not approved');
    }

    // Exam Mode Conflict Check
    const requestedDate = data.scheduledTime ? new Date(data.scheduledTime) : new Date();
    const conflictDate = await this.examModeService.checkVendorAvailabilityConflict(data.vendorId, requestedDate);

    // Calculate totals from packs or items
    let subtotal = 0;
    let prepaidSubtotal = 0;
    let hasPrepaidItems = false;
    let allProductIds: Types.ObjectId[] = [];

    if (data.packs && data.packs.length > 0) {
      data.packs.forEach((pack: any) => {
        pack.items.forEach((item: any) => {
          if (item.productId || item.product) {
            allProductIds.push(new Types.ObjectId(item.productId || item.product));
          }
        });
      });
    } else if (data.items) {
      allProductIds = data.items.map((i: any) => new Types.ObjectId(i.productId || i.product));
    }

    const allProducts = await this.productModel.find({ _id: { $in: allProductIds } }).lean();
    const allMenuItems = await this.menuItemModel.find({ _id: { $in: allProductIds } }).lean();
    const allMenuPacks = await this.menuPackModel.find({ _id: { $in: allProductIds } }).lean();

    const productMap = [...allProducts, ...allMenuItems, ...allMenuPacks].reduce((acc, p) => {
      acc[p._id.toString()] = p;
      return acc;
    }, {} as Record<string, any>);

    if (data.packs && data.packs.length > 0) {
      subtotal = data.packs.reduce((packSum: number, pack: any) =>
        packSum + pack.items.reduce((itemSum: number, item: any) => {
          const itemTotal = (item.subtotal || item.price * item.quantity);
          const pData = productMap[(item.productId || item.product)?.toString()];
          if (pData?.isPrepaidByPlatform) {
            prepaidSubtotal += itemTotal;
            hasPrepaidItems = true;
          }
          return itemSum + itemTotal;
        }, 0),
        0,
      );
    } else if (data.items) {
      subtotal = data.items.reduce(
        (sum: number, item: any) => {
          const pData = productMap[(item.productId || item.product)?.toString()];
          item.image = pData?.image || pData?.images?.[0];
          const itemTotal = item.subtotal;
          if (pData?.isPrepaidByPlatform) {
            prepaidSubtotal += itemTotal;
            hasPrepaidItems = true;
          }
          return sum + itemTotal;
        },
        0,
      );
    }

    if (data.deliveryOption === 'pickup') {
      throw new BadRequestException('Self pickup is no longer supported.');
    }
    const deliveryOption = data.deliveryOption || 'use_an_errander';
    const deliveryMode = data.deliveryMode || 'room_delivery';
    let deliveryFee = 0;
    
    // Fetch delivery pricing config from admin system settings
    const deliveryFeesConfig = await this.settingModel.findOne({ key: 'custom_errand' }).exec();
    const roomDeliveryFee = deliveryFeesConfig?.value?.roomDeliveryFee ?? 350;
    const dropoffServiceFee = deliveryFeesConfig?.value?.dropoffServiceFee ?? 300;
    
    if (deliveryOption === 'use_an_errander') {
      if (deliveryMode === 'dropoff_service') {
        deliveryFee = dropoffServiceFee;
      } else {
        deliveryFee = roomDeliveryFee;
      }
    } else if (deliveryOption === 'batch_run') {
      deliveryFee = 150;
    }

    // Apply Campus Prime logic
    const userForPrime = await this.userModel.findById(customerId);
    if (userForPrime?.campusPrimeActive && userForPrime.campusPrimeExpiry && userForPrime.campusPrimeExpiry > new Date()) {
      deliveryFee = 0;
    }

    // Move discount, promoDiscount, appliedPromoCode declarations here so they are available early
    let discount = 0;
    let promoDiscount = 0;
    let appliedPromoCode: string | null = null;

    const campaignSetting = await this.settingModel.findOne({ key: 'exam_brethren_campaign' }).exec();
    const isExamBrethrenActive = campaignSetting?.value?.isActive || false;

    let groupDiscount = 0;
    if (data.groupId || data.isGroupOrder) {
      const groupOrdersCount = await this.orderModel.countDocuments({ groupId: data.groupId });
      if (groupOrdersCount > 0) {
        groupDiscount = Math.round(deliveryFee * 0.3);
        deliveryFee -= groupDiscount;
      }
      
      if (isExamBrethrenActive) {
        // Brethren Split: 10% off subtotal for group orders
        const splitDiscount = Math.round(subtotal * 0.10);
        discount += splitDiscount;
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

    const serviceFee = typeof data.serviceFee === 'number' ? data.serviceFee : Math.round(subtotal * 0.05); // Use frontend passed fee or default to 5%
    const platformProcessingFee = data.platformProcessingFee || 0;
    
    // Batch Delivery logic for delivery fee or grouping
    const isBatchActive = await this.batchDeliveryService.isWindowActive();
    
    // New Packaging Packs logic
    let packagingFee = 0;
    let selectedPackData = null;

    if (data.packs && data.packs.length > 0) {
      // Sum packaging fee from each individual pack if they have a packType selected
      data.packs.forEach((pack: any) => {
        let isFeeIncluded = false;
        pack.items?.forEach((item: any) => {
          const pData = productMap[(item.productId || item.product)?.toString()];
          if (pData?.isPackagingFeeIncluded) isFeeIncluded = true;
        });

        if (!isFeeIncluded) {
          if (pack.packType && pack.packType.price !== undefined) {
            packagingFee += pack.packType.price;
          } else if (data.selectedPack && data.selectedPack.name) {
            packagingFee += data.selectedPack.price ?? vendor.packagingFee ?? 300;
          } else {
            packagingFee += vendor.packagingFee ?? 300;
          }
        }
      });
      // Legacy fallback
      if (data.selectedPack && data.selectedPack.name && packagingFee === 0) {
        selectedPackData = data.selectedPack;
      }
    } else {
      let isFeeIncluded = false;
      data.items?.forEach((item: any) => {
        const pData = productMap[(item.productId || item.product)?.toString()];
        if (pData?.isPackagingFeeIncluded) isFeeIncluded = true;
      });

      if (!isFeeIncluded) {
        packagingFee = vendor.packagingFee ?? 300;
        if (data.selectedPack && data.selectedPack.name) {
          packagingFee = data.selectedPack.price ?? vendor.packagingFee ?? 300;
          selectedPackData = data.selectedPack;
        }
      }
    }

    // Fetch custom errand settings to get commission percentage for delivery fee
    const errandSetting = await this.settingModel.findOne({ key: 'custom_errand' }).exec();
    const commissionFlatFee = deliveryFeesConfig?.value?.platformFee ?? 50;
    const deliveryCommission = commissionFlatFee;
    
    // Save errander payout (delivery fee minus platform commission)
    const erranderPayout = deliveryFee - deliveryCommission;
    
    // Calculate platform share (service fee + delivery commission + food markup)
    const markupPct = errandSetting?.value?.foodMarkupPercentage ?? 5;
    const MARKUP_FACTOR = 1 + (markupPct / 100);
    const foodMarkup = subtotal - Math.round(subtotal / MARKUP_FACTOR);
    let platformShare = serviceFee + deliveryCommission + foodMarkup;
    
    // Calculate vendor share (vendor subtotal + packaging fee)
    const vendorSubtotal = Math.round(subtotal / MARKUP_FACTOR);
    const prepaidVendorSubtotal = Math.round(prepaidSubtotal / MARKUP_FACTOR);
    
    let vendorShare = vendorSubtotal - prepaidVendorSubtotal;
    platformShare += prepaidVendorSubtotal; // Platform intercepts prepaid food subtotal
    
    // Platform intercepts packaging fee if there are prepaid items (promo logic)
    if (hasPrepaidItems) {
      platformShare += packagingFee;
    } else {
      vendorShare += packagingFee;
    }

    // ── Vendor-Level Prepaid Promo (e.g. "pick anything worth ₦2000") ──
    let isVendorPrepaidPromo = false;
    if (
      vendor.prepaidPromo &&
      vendor.prepaidPromo.enabled &&
      vendor.prepaidPromo.maxOrders > 0 &&
      vendor.prepaidPromo.usedOrders < vendor.prepaidPromo.maxOrders
    ) {
      isVendorPrepaidPromo = true;
      // Route ALL vendor revenue (subtotal + packaging) to platform
      platformShare += vendorShare; // absorb whatever vendor would have gotten
      vendorShare = 0;

      // Increment the used counter atomically
      await this.vendorModel.findByIdAndUpdate(vendor._id, {
        $inc: { 'prepaidPromo.usedOrders': 1 },
      });
    }

    // Exam Night Owl Free Delivery (10 PM - 2 AM)
    if (isExamBrethrenActive) {
      const currentHour = new Date().getHours();
      if (currentHour >= 22 || currentHour < 2) {
        if (deliveryFee > 0) {
          discount += deliveryFee;
          deliveryFee = 0;
        }
      }
    }

    // Birthday Discount Logic
    let isBirthdayDiscount = false;
    const user = await this.userModel.findById(customerId);
    
    if (user && user.dateOfBirth) {
      const today = new Date();
      const dob = new Date(user.dateOfBirth);
      // Check if month and day match
      if (today.getMonth() === dob.getMonth() && today.getDate() === dob.getDate()) {
        isBirthdayDiscount = true;
        // 100% Free delivery
        discount += deliveryFee;
        deliveryFee = 0;
        // 10% off subtotal
        const subtotalDiscount = Math.round(subtotal * 0.10);
        discount += subtotalDiscount;
        // Fix: Do not subtract from subtotal here since discount is subtracted from total later
      }
    }

    // Gamified Streaks: Free Delivery Token Usage
    if (data.useFreeDeliveryToken && user && user.freeDeliveryTokens > 0 && deliveryFee > 0) {
      discount += deliveryFee;
      deliveryFee = 0;
      user.freeDeliveryTokens -= 1;
      await user.save();
    }

    // Promo Code Logic
    if (data.promoCode) {
      try {
        const userOrdersCount = await this.orderModel.countDocuments({ customer: customerId });
        const promo = await this.promoCodesService.validateCode(data.promoCode, subtotal, customerId, data.vendor?.toString(), userOrdersCount);
        let pDiscount = 0;
        if (promo.discountType === 'percentage') {
          pDiscount = Math.round(subtotal * (promo.value / 100));
          if (promo.maxDiscountAmount && pDiscount > promo.maxDiscountAmount) {
            pDiscount = promo.maxDiscountAmount;
          }
        } else {
          pDiscount = promo.value;
        }
        
        discount += pDiscount;
        promoDiscount = pDiscount;
        appliedPromoCode = promo.code;
        
        // Increment usage
        await this.promoCodesService.incrementUsage(promo.code);
      } catch (e) {
        // Ignore invalid promo codes or handle error
        this.logger.warn(`Invalid promo code applied: ${data.promoCode} - ${e.message}`);
      }
    }

    // Combo Promo Discount
    let isPrepaidPromoApplied = false;
    if (vendor && vendor.prepaidPromo && vendor.prepaidPromo.enabled) {
      if (vendor.prepaidPromo.usedOrders < vendor.prepaidPromo.maxOrders) {
        if (subtotal >= vendor.prepaidPromo.budgetPerOrder) {
          discount += (vendor.prepaidPromo && vendor.prepaidPromo.discountValue) ? vendor.prepaidPromo.discountValue : 1000;
          isPrepaidPromoApplied = true;
          // Note: usedOrders is strictly incremented via the atomic update at the top of the function
        }
      }
    }

    // If the promo is explicitly disabled, do not apply any fallback legacy logic
    if (vendor && vendor.prepaidPromo && vendor.prepaidPromo.enabled === false) {
      // explicitly disabled, do not apply promo
    } else if (!isPrepaidPromoApplied && vendor && (vendor.storeName.toLowerCase().includes('iyabo') || vendor.storeName.toLowerCase().includes('hvip') || vendor.storeName.toLowerCase().includes('waris') || vendor.storeName.toLowerCase().includes('chijioke'))) {
      if (vendor.storeName.toLowerCase().includes('waris')) {
        if (subtotal >= 2000) {
          discount += (vendor.prepaidPromo && vendor.prepaidPromo.discountValue) ? vendor.prepaidPromo.discountValue : 1000;
        }
      } else {
        let isCombo = false;
        
        // Check packs
        if (data.packs) {
          for (const pack of data.packs) {
            if (pack.name?.toLowerCase().includes('combo') || pack.packType === 'combo') isCombo = true;
            for (const item of (pack.items || [])) {
              if (item.name?.toLowerCase().includes('combo')) isCombo = true;
              if (item.product) {
                 const p = await this.productModel.findById(item.product);
                 if (p && (p as any).isPrepaidByPlatform) isCombo = true;
              }
            }
          }
        }
        
        // Check menu items
        if (data.items) {
          for (const item of data.items) {
            if (item.name?.toLowerCase().includes('combo')) isCombo = true;
            if (item.menuItem) {
               const mi = await this.menuItemModel.findById(item.menuItem);
               if (mi && mi.isPrepaidByPlatform) isCombo = true;
            }
          }
        }

        if (isCombo) {
          discount += (vendor.prepaidPromo && vendor.prepaidPromo.discountValue) ? vendor.prepaidPromo.discountValue : 1000;
        }
      }
    }

    const total = subtotal + deliveryFee + serviceFee + packagingFee + platformProcessingFee - discount;

    // Optional Paystack verification if reference is passed (e.g., from some legacy flows)
    let paymentVerified = false;
    if (data.paymentReference) {
      const verification = await this.paystackService.verifyTransaction(data.paymentReference);
      if (verification?.status === 'success' && verification.amount >= total - 5) {
         paymentVerified = true;
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
      deliveryPin: Math.floor(1000 + Math.random() * 9000).toString(),
      customer: new Types.ObjectId(customerId),
      vendor: new Types.ObjectId(data.vendorId),
      items: flatItems,
      packs: data.packs || [],
      selectedPack: selectedPackData,
      subtotal,
      deliveryFee,
      erranderPayout,
      platformShare,
      vendorShare,
      foodMarkupPercentage: markupPct,
      serviceFee,
      platformProcessingFee,
      packagingFee,

      paymentMethod: data.paymentMethod,
      orderType: data.orderType || OrderType.MARKETPLACE,
      isGroupOrder: data.isGroupOrder || false,
      isDormDelivery: data.isDormDelivery || false,
      groupId: data.groupId,
      isMysteryBox: data.isMysteryBox || false,
      mysteryProduct,
      discount,
      promoCode: appliedPromoCode,
      promoDiscount,
      isBirthdayDiscount,
      total,
      weight: data.weight || 1,
      deliveryOption,
      recipientName: data.recipientName || '',
      recipientPhone: data.recipientPhone || '',
      specificAddress: data.specificAddress || '',
      groupDiscount,
      deliveryAddress: data.deliveryAddress || data.specificAddress || '',
      deliveryLocation: data.deliveryLocation,
      deliveryNotes: data.deliveryNotes,
      paymentStatus: (paymentVerified || data.paymentMethod === 'cash') ? PaymentStatus.PAID : PaymentStatus.PENDING,
      paymentReference: data.paymentReference,
      locationType: data.locationType || LocationType.INSIDE_CAMPUS,
      proposedDeliveryFee: data.locationType === LocationType.OUTSIDE_CAMPUS ? Number(data.proposedDeliveryFee) : undefined,
      status: data.locationType === LocationType.OUTSIDE_CAMPUS 
                ? OrderStatus.NEGOTIATING 
                : (paymentVerified || data.paymentMethod === 'cash') 
                ? (data.isPreOrder ? OrderStatus.SCHEDULED : OrderStatus.CONFIRMED) 
                : OrderStatus.PENDING,
      statusHistory: [
        { 
          status: data.locationType === LocationType.OUTSIDE_CAMPUS 
                    ? OrderStatus.NEGOTIATING 
                    : (paymentVerified || data.paymentMethod === 'cash') 
                    ? (data.isPreOrder ? OrderStatus.SCHEDULED : OrderStatus.CONFIRMED) 
                    : OrderStatus.PENDING,
          timestamp: new Date(), 
          note: data.locationType === LocationType.OUTSIDE_CAMPUS ? 'Negotiating with riders' : (paymentVerified || data.paymentMethod === 'cash') 
                  ? (data.isPreOrder ? 'Order scheduled for a later time' : 'Order placed and payment confirmed') 
                  : 'Order placed, awaiting payment' 
        },
      ],
      isPreOrder: data.isPreOrder || false,
      scheduledTime: data.scheduledDate || data.scheduledTime || null, // Capture exact time
      scheduledDate: data.scheduledDate || '',
      vendorNote: data.vendorNote || '',
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

    // Trigger Vendor Notification Cascade & Fetch for later use
    const populatedVendor = await this.vendorModel.findById(data.vendorId).populate('owner');

    // Process vendor payout immediately only if paid
    if (order.paymentStatus === PaymentStatus.PAID) {
      await this.processVendorPayout(order);

      // Exam Mode: Handle conflict or proceed normally
      if (conflictDate) {
        // Order placed during an unavailable window
        order.status = OrderStatus.PENDING; // Keep it pending until resolved
        await order.save();
        
        this.logger.log(`Order ${order.orderNumber} intercepted for Exam Mode. Auto-suggesting reschedule to ${conflictDate}.`);
        await this.examModeService.createRescheduleRequest(
          order._id.toString(),
          data.vendorId,
          customerId,
          requestedDate,
          conflictDate
        );
      } else {
        // Always broadcast since payment is guaranteed
        await this.broadcastNewOrderToErranders(order);

        if (populatedVendor) {
          // Fire-and-forget cascade
          this.notificationsService.notifyVendor(populatedVendor, order).catch(e => {
            this.logger.error(`Vendor notification cascade failed: ${e.message}`);
          });
        }
      }
    } else if (order.status === OrderStatus.NEGOTIATING) {
      // Outside campus: Broadcast to erranders for negotiation but DON'T notify vendor yet
      // Vendor notification will happen after negotiation + payment is complete
      await this.broadcastNewOrderToErranders(order);
      this.logger.log(`NEGOTIATING order ${order.orderNumber} broadcasted to erranders for bidding (vendor NOT notified yet).`);
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
        const message = `Hello, this is Erranders. You have a new order #${order.orderNumber} for ${order.total} Naira. Items: ${itemsList.join(', ')}. Please prepare it.`;
        await this.notificationsService.sendZavuSMS(populatedVendor.phone, message);
        this.logger.log(`Triggered automated order dispatch SMS for order ${order.orderNumber} to ${populatedVendor.phone}`);
      } catch (e) {
        this.logger.error(`Failed to trigger dispatch call: ${e.message}`);
      }
    }

    // UPDATE GAMIFIED STREAK
    if (user && order.paymentStatus === PaymentStatus.PAID) {
      const today = new Date();
      if (!user.lastOrderDate) {
        user.streakCount = 1;
        user.highestStreak = Math.max(1, user.highestStreak || 0);
      } else {
        const oneWeek = 7 * 24 * 60 * 60 * 1000;
        const diff = today.getTime() - new Date(user.lastOrderDate).getTime();
        
        // If order was in a previous week (between 7 and 14 days)
        if (diff >= oneWeek && diff < 2 * oneWeek) {
          user.streakCount = (user.streakCount || 0) + 1;
        } 
        // If order was more than 2 weeks ago, streak resets
        else if (diff >= 2 * oneWeek) {
          user.streakCount = 1;
        }
        // If less than 1 week, streak doesn't increment (already counted for this week)
      }
      
      user.lastOrderDate = today;
      if (user.streakCount > (user.highestStreak || 0)) {
        user.highestStreak = user.streakCount;
      }
      
      // Grant Free Delivery Token every 4 weeks
      if (user.streakCount > 0 && user.streakCount % 4 === 0) {
        user.freeDeliveryTokens = (user.freeDeliveryTokens || 0) + 1;
      }
      
      await user.save();
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
      await this.processErranderPayout(order);

      // Trigger engagement updates
      if (order.customer) {
        await this.rewardsService.updateUserStats((order.customer as any)._id.toString(), { orders: 1, streak: true });
      }
      if (order.errander) {
        // Find owner user ID from errander profile
        const errander = await this.erranderModel.findById((order.errander as any)._id);
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
      if (status === OrderStatus.DELIVERED && order.status !== OrderStatus.DELIVERED) {
        const vendorId = order.vendor as any;
        await this.vendorModel.findByIdAndUpdate(vendorId, {
          $inc: { 
            totalOrders: 1,
            totalRevenue: order.total 
          }
        });
        
        // Increment orderCount for items
        if (order.items && order.items.length > 0) {
          for (const item of order.items) {
            if (item.product) {
              await this.productModel.findByIdAndUpdate(item.product, { $inc: { orderCount: item.quantity } });
            }
          }
        }
        
        if ((order as any).menuItems && (order as any).menuItems.length > 0) {
          for (const mItem of (order as any).menuItems) {
            if (mItem.menuItem) {
              await this.menuItemModel.findByIdAndUpdate(mItem.menuItem, { $inc: { orderCount: mItem.quantity } });
            }
          }
        }
      }

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

  async acceptOrder(orderId: string, erranderId: string, isAdmin = false): Promise<Order> {
    const isBatchActive = await this.batchDeliveryService.isWindowActive();
    // Allow multiple concurrent orders (up to 5 max) to clear more orders


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

    // Check verification level limits
    const targetOrder = await this.orderModel.findById(orderId);
    if (!targetOrder || ![OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY_FOR_PICKUP, OrderStatus.NEGOTIATING].includes(targetOrder.status as any)) {
      throw new BadRequestException('Order is no longer available');
    }

    const level = errander.verificationLevel || 1;
    if (!isAdmin) {
      if (level < 2) {
        throw new BadRequestException('You must be verified (at least Tier 2) to accept orders.');
      }
      if (level < 3) {
        const orderValue = targetOrder.total || (targetOrder.customDetails?.estimatedItemCost || 0);
        if (orderValue > 3000) {
          throw new BadRequestException('You need Tier 3 (Verified Pro) status to accept orders above ₦3,000');
        }
        if (targetOrder.paymentMethod === 'cash') {
          throw new BadRequestException('You need Tier 3 (Verified Pro) status to accept Cash on Delivery orders');
        }
      }

      // Check current load
      const currentActiveCount = (errander.batchOrders?.length || 0) + (errander.currentOrder ? 1 : 0);

      const erranderSettings = await this.settingModel.findOne({ key: 'errander_settings' }).exec();
      const maxOrders = erranderSettings?.value?.maxConcurrentOrders || 0;
      
      if (maxOrders > 0 && currentActiveCount >= maxOrders) {
        throw new BadRequestException(
          isBatchActive 
            ? `You have reached the maximum number of concurrent orders (${maxOrders}) for this batch window.`
            : 'You already have an active order. Complete it before accepting another.'
        );
      }
    }

    const newStatus = targetOrder.status === OrderStatus.PENDING ? OrderStatus.CONFIRMED : targetOrder.status;

    // ATOMIC UPDATE: Only update if no errander is assigned yet and status hasn't changed
    const order = await this.orderModel.findOneAndUpdate(
      { 
        _id: new Types.ObjectId(orderId), 
        errander: { $exists: false },
        status: targetOrder.status 
      },
      {
        $set: {
          errander: new Types.ObjectId(erranderId),
          status: newStatus,
        },
        $push: {
          statusHistory: {
            status: newStatus,
            timestamp: new Date(),
            note: isAdmin ? 'Order manually assigned by admin' : (isBatchActive ? 'Order accepted as part of Batch Delivery' : 'Order accepted by errander'),
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

    // === CUSTOM ERRAND: Transfer item cost to errander's bank account ===
    if (order.type === OrderType.CUSTOM_ERRAND && order.customDetails?.estimatedItemCost > 0) {
      const erranderWallet = await this.walletsService.getOrCreateWallet(erranderId);
      const bankDetails = erranderWallet.bankDetails;

      if (!bankDetails?.accountNumber || !bankDetails?.bankCode) {
        // Rollback: unassign errander, set status back to PENDING, re-broadcast
        await this.orderModel.findByIdAndUpdate(orderId, {
          $unset: { errander: '' },
          $set: { status: OrderStatus.PENDING },
          $push: {
            statusHistory: {
              status: OrderStatus.PENDING,
              timestamp: new Date(),
              note: 'Acceptance rolled back — errander has no bank details',
            } as any
          }
        });
        errander.status = ErranderStatus.AVAILABLE;
        errander.currentOrder = null as any;
        errander.batchOrders = errander.batchOrders?.filter(id => id.toString() !== orderId) || [];
        await errander.save();
        throw new BadRequestException('You need to add your bank details in Wallet settings before accepting market-run errands. The item cost needs to be transferred to your bank.');
      }

      // Initiate Paystack Transfer
      const itemCost = order.customDetails.estimatedItemCost;
      const transferRef = `ITEM-${order.orderNumber}-${uuidv4().slice(0, 6).toUpperCase()}`;
      
      try {
        const recipient = await this.paystackService.createTransferRecipient({
          name: bankDetails.accountName || erranderUser?.firstName || 'Errander',
          account_number: bankDetails.accountNumber,
          bank_code: bankDetails.bankCode,
        });

        const transfer = await this.paystackService.initiateTransfer({
          amount: itemCost,
          reference: transferRef,
          recipient: recipient.recipient_code,
          reason: `Item cost for errand ${order.orderNumber}`,
        });

        if ((transfer as any).status === true || (transfer as any).status === 'success') {
          order.itemCostDisbursementStatus = 'transferred';
          order.itemCostTransferReference = transferRef;
          await order.save();
          this.logger.log(`Item cost ₦${itemCost} transferred to errander ${erranderId} bank for order ${order.orderNumber}`);
        } else {
          throw new Error((transfer as any).message || 'Transfer failed');
        }
      } catch (transferError: any) {
        this.logger.error(`Item cost transfer failed for order ${order.orderNumber}: ${transferError.message}`);
        
        // Check if this is a test/mock environment
        const isTestKey = process.env.PAYSTACK_SECRET_KEY?.startsWith('sk_test');
        const useMock = Boolean(isTestKey || process.env.USE_MOCK_PAYOUT === 'true');
        
        if (useMock) {
          // In test mode, mock the transfer and proceed
          order.itemCostDisbursementStatus = 'transferred';
          order.itemCostTransferReference = `MOCK-${transferRef}`;
          await order.save();
          this.logger.log(`[MOCK] Item cost ₦${itemCost} mock-transferred for order ${order.orderNumber}`);
        } else {
          // In production, rollback the acceptance
          order.itemCostDisbursementStatus = 'failed';
          await order.save();
          
          await this.orderModel.findByIdAndUpdate(orderId, {
            $unset: { errander: '' },
            $set: { status: OrderStatus.PENDING, itemCostDisbursementStatus: 'pending' },
            $push: {
              statusHistory: {
                status: OrderStatus.PENDING,
                timestamp: new Date(),
                note: 'Acceptance rolled back — item cost bank transfer failed',
              } as any
            }
          });
          errander.status = ErranderStatus.AVAILABLE;
          errander.currentOrder = null as any;
          errander.batchOrders = errander.batchOrders?.filter(id => id.toString() !== orderId) || [];
          await errander.save();
          await this.broadcastNewOrderToErranders(order);
          throw new BadRequestException('We couldn\'t transfer the item cost to your bank account. Please verify your bank details and try again.');
        }
      }
    }

    // Update errander status and batch list (always use batchOrders to support multiple concurrent normal orders)
    errander.status = ErranderStatus.BUSY;
    if (!errander.batchOrders) errander.batchOrders = [];
    errander.batchOrders.push(order._id as Types.ObjectId);
    
    // Also set currentOrder for backwards compatibility with single-order tracking
    if (!isBatchActive && !errander.currentOrder) {
      errander.currentOrder = order._id as Types.ObjectId;
    }
    await errander.save();

    // Notify all parties via stored notifications + real-time
    await this.notifyOrderStatusUpdate(order, OrderStatus.CONFIRMED, 'Order accepted by errander');

    // Broadcast order accepted so it is removed from the dispatch pool for all other riders
    await this.redisService.publish('notification:broadcast:erranders', JSON.stringify({
      type: 'ORDER_ACCEPTED',
      data: { orderId: order._id.toString() }
    }));

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

    // REAL-TIME VENDOR PAYOUT (only for marketplace orders with a vendor)
    if (order.vendor) {
      let vendorEarnings = (order as any).vendorShare;
      if (!vendorEarnings) {
        const errandSetting = await this.settingModel.findOne({ key: 'custom_errand' }).exec();
        const markupPct = errandSetting?.value?.foodMarkupPercentage ?? 5;
        const MARKUP_FACTOR = 1 + (markupPct / 100);
        const vendorSubtotal = Math.round(order.subtotal / MARKUP_FACTOR);
        const vendorPackaging = order.packagingFee || 0; // Vendor gets 100% of packaging fee
        vendorEarnings = vendorSubtotal + vendorPackaging;
      }
      
      const populatedVendor = await this.vendorModel.findById(order.vendor);
      if (populatedVendor && populatedVendor.owner) {
        await this.walletsService.creditWallet(
          populatedVendor.owner.toString(),
          vendorEarnings,
          `Payment for order ${order.orderNumber} (Accepted by vendor)`,
          order._id.toString(),
        );
      }
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
    const errander = await this.erranderModel.findOne({ user: erranderId });
    if (!errander) throw new BadRequestException('Errander profile not found');
    
    const orderErranderId = (order.errander as any)?._id?.toString() || order.errander?.toString();
    this.logger.log(`completeOrder check: order.errander=${orderErranderId} vs erranderId=${erranderId.toString()}`);
    
    if (orderErranderId !== errander._id.toString() && orderErranderId !== erranderId.toString()) {
      this.logger.error(`Assignment mismatch: ${orderErranderId} !== ${errander._id.toString()} or ${erranderId.toString()}`);
      throw new BadRequestException('You are not assigned to this order');
    }

    // Verify Delivery PIN
    if (order.deliveryPin !== verificationCode) {
      throw new BadRequestException('Invalid Delivery PIN provided by student');
    }

    order.deliveryPinStatus = 'verified';
    order.status = OrderStatus.DELIVERED;
    order.actualDeliveryTime = new Date();
    order.statusHistory.push({
      status: OrderStatus.DELIVERED,
      timestamp: new Date(),
      note: 'Order completed via Delivery PIN',
    });

    // ERRANDER PAYOUT
    const erranderEarnings = order.erranderPayout || order.deliveryFee;
    await this.walletsService.creditWallet(
      erranderId,
      erranderEarnings,
      `Delivery earnings for order ${order.orderNumber}`,
      order._id.toString(),
    );

    // Free up errander or update batch
    const erranderDoc = await this.erranderModel.findOne({ user: new Types.ObjectId(erranderId) });
    if (erranderDoc) {
      if (erranderDoc.currentOrder?.toString() === orderId) {
        (erranderDoc as any).currentOrder = null;
      }
      erranderDoc.batchOrders = erranderDoc.batchOrders?.filter(id => id.toString() !== orderId) || [];
      
      if (!erranderDoc.currentOrder && (!erranderDoc.batchOrders || erranderDoc.batchOrders.length === 0)) {
        erranderDoc.status = ErranderStatus.AVAILABLE;
      }

      erranderDoc.totalDeliveries = (erranderDoc.totalDeliveries || 0) + 1;
      erranderDoc.totalEarnings = (erranderDoc.totalEarnings || 0) + erranderEarnings;

      await erranderDoc.save();
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

  async bypassDeliveryPinWithPhoto(orderId: string, erranderId: string, imageUrl: string): Promise<Order> {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    
    // Security check: only assigned errander can complete
    const errander = await this.erranderModel.findOne({ user: erranderId });
    if (!errander) throw new BadRequestException('Errander profile not found');

    const orderErranderId = (order.errander as any)?._id?.toString() || order.errander?.toString();
    if (orderErranderId !== errander._id.toString() && orderErranderId !== erranderId.toString()) {
      throw new BadRequestException('You are not assigned to this order');
    }

    if (!imageUrl) {
      throw new BadRequestException('Photo proof is required for contactless drop-off');
    }

    order.deliveryPinStatus = 'bypassed_contactless';
    order.contactlessDropoffImage = imageUrl;
    order.status = OrderStatus.DELIVERED;
    order.actualDeliveryTime = new Date();
    order.statusHistory.push({
      status: OrderStatus.DELIVERED,
      timestamp: new Date(),
      note: 'Order completed via Contactless Drop-off (Photo Proof)',
    });

    // ERRANDER PAYOUT
    const erranderEarnings = order.erranderPayout || order.deliveryFee;
    await this.walletsService.creditWallet(
      erranderId,
      erranderEarnings,
      `Delivery earnings for order ${order.orderNumber}`,
      order._id.toString(),
    );

    // Free up errander or update batch
    const erranderDoc = await this.erranderModel.findOne({ user: new Types.ObjectId(erranderId) });
    if (erranderDoc) {
      if (erranderDoc.currentOrder?.toString() === orderId) {
        (erranderDoc as any).currentOrder = null;
      }
      erranderDoc.batchOrders = erranderDoc.batchOrders?.filter(id => id.toString() !== orderId) || [];
      
      if (!erranderDoc.currentOrder && (!erranderDoc.batchOrders || erranderDoc.batchOrders.length === 0)) {
        erranderDoc.status = ErranderStatus.AVAILABLE;
      }

      erranderDoc.totalDeliveries = (erranderDoc.totalDeliveries || 0) + 1;
      erranderDoc.totalEarnings = (erranderDoc.totalEarnings || 0) + erranderEarnings;

      await erranderDoc.save();
    }

    // Award Points for Order Completion
    await this.rewardsService.addPoints(order.customer.toString(), 25, `Completed order #${order.orderNumber}`);

    // Reward for Erranders Consistency
    await this.rewardsService.addPoints(erranderId, 20, `Successful delivery of order #${order.orderNumber}`);

    await order.save();
    await this.notifyOrderStatusUpdate(order, OrderStatus.DELIVERED, 'Order delivered via Contactless Drop-off');
    return this.findById(orderId);
  }

  async getCustomerOrders(customerId: string, page: any = 1, limit: any = 20) {
    const p = Math.max(1, parseInt(page) || 1);
    const l = Math.max(1, parseInt(limit) || 20);
    const skip = (p - 1) * l;

    const [orders, total] = await Promise.all([
      this.orderModel
        .find({ customer: new Types.ObjectId(customerId) })
        .populate('vendor', 'storeName logo banner isOnline businessHours breakPeriod openingTime closingTime isOpen')
        .populate('errander', 'firstName lastName phone avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(l),
      this.orderModel.countDocuments({ customer: new Types.ObjectId(customerId) }),
    ]);

    const augmentedOrders = orders.map((o: any) => {
      const orderObj = o.toObject ? o.toObject() : o;
      if (orderObj.vendor) {
        orderObj.vendor = augmentVendor(orderObj.vendor);
      }
      return orderObj;
    });

    return { orders: augmentedOrders, total };
  }

  async getVendorOrders(vendorId: string, status?: OrderStatus, page: any = 1, limit: any = 50) {
    if (!Types.ObjectId.isValid(vendorId)) {
      return { orders: [], total: 0 };
    }
    const filter: any = { vendor: new Types.ObjectId(vendorId) };
    if (status) {
      filter.status = status;
    } else {
      filter.status = { $nin: [OrderStatus.PENDING, OrderStatus.AWAITING_PAYMENT] };
    }

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
      if (status) {
        filter.status = status;
      } else {
        filter.status = { $nin: [OrderStatus.PENDING, OrderStatus.AWAITING_PAYMENT] };
      }
      const p = Math.max(1, Number(page) || 1);
      const l = Math.max(1, Number(limit) || 50);
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

  async submitFeedback(id: string, feedback: string) {
    if (!feedback || feedback.trim() === '') {
      throw new BadRequestException('Feedback cannot be empty');
    }
    const order = await this.orderModel.findByIdAndUpdate(
      id,
      { abandonmentFeedback: feedback },
      { new: true }
    );
    if (!order) throw new NotFoundException('Order not found');
    return { success: true, message: 'Feedback submitted successfully' };
  }

  async getErranderOrders(erranderId: string) {
    return this.orderModel
      .find({ errander: new Types.ObjectId(erranderId) })
      .populate('vendor', 'storeName logo address location')
      .populate('customer', 'firstName lastName phone avatar deliveryAddress location gender')
      .sort({ createdAt: -1 });
  }

  async getAvailableOrders() {
    return this.orderModel
      .find({
        status: { $in: [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY_FOR_PICKUP, OrderStatus.NEGOTIATING] },
        errander: { $exists: false },
         $or: [
          { deliveryOption: 'use_an_errander' },
          { deliveryOption: { $exists: false } },
          { deliveryOption: null }
        ]
      })
      .populate('vendor', 'storeName logo address location')
      .populate('customer', 'firstName lastName deliveryAddress location gender')
      .sort({ createdAt: -1 });
  }

  async findById(id: string): Promise<any> {
    return this.withRetry(async () => {
      const order = await this.orderModel
        .findById(id)
        .populate('customer', 'firstName lastName phone avatar deliveryAddress location gender')
        .populate({
          path: 'vendor',
          select: 'storeName logo phone address location user owner',
          populate: { path: 'owner', select: 'phone' }
        })
        .populate('errander', 'firstName lastName phone user')
        .populate('bids.errander', 'firstName lastName avatar phone')
        .populate('viewers.errander', 'firstName lastName avatar phone')
        .maxTimeMS(10000)
        .lean();
      if (!order) throw new NotFoundException('Order not found');

      if (order.errander) {
        const erranderDetails = await this.erranderModel.findOne({ user: (order.errander as any)._id }).maxTimeMS(5000).lean();
        if (erranderDetails) {
          (order as any).erranderDetails = erranderDetails;
        }
      }

      // Attach WhatsApp Links
      const customerPhone = (order.customer as any)?.phone;
      const vendorPhone = (order.vendor as any)?.phone || (order.vendor as any)?.owner?.phone;
      const erranderPhone = (order.errander as any)?.phone;

      const formatWa = (p) => p ? `https://wa.me/${p.replace(/\+/g, '')}` : null;

      (order as any).whatsappLinks = {
        customer: formatWa(customerPhone),
        vendor: formatWa(vendorPhone),
        errander: formatWa(erranderPhone),
      };

      return order;
    }, 'findById');
  }

  async processVendorPayout(order: Order): Promise<void> {
    const fullOrder = await this.orderModel.findById(order._id)
      .populate({
        path: 'vendor',
        populate: {
          path: 'owner',
          select: 'email firstName lastName'
        }
      });

    if (!fullOrder || !fullOrder.vendor) return;

    let vendorEarnings = (fullOrder as any).vendorShare;
    if (!vendorEarnings) {
      const errandSetting = await this.settingModel.findOne({ key: 'custom_errand' }).exec();
      const markupPct = errandSetting?.value?.foodMarkupPercentage ?? 5;
      const MARKUP_FACTOR = 1 + (markupPct / 100);
      const vendorSubtotal = Math.round(fullOrder.subtotal / MARKUP_FACTOR);
      const vendorPackaging = fullOrder.packagingFee || 0; // Vendor gets 100% of packaging fee
      vendorEarnings = vendorSubtotal + vendorPackaging;
    }
    
    const vendorDoc = fullOrder.vendor as any;
    // Note: the user reference on vendor might be 'owner' or 'user'. Let's check which one it is.
    // In many places, vendor has 'owner'. 
    const vendorUser = vendorDoc.owner || vendorDoc.user;

    if (vendorUser && vendorUser._id) {
      const userId = vendorUser._id.toString();
      
      // Check if combo purchase (Admin has already pre-paid the business)
      let isCombo = false;
      if (fullOrder.packs) {
        for (const pack of fullOrder.packs) {
          for (const item of pack.items) {
             if (item.product) {
               const prod = await this.productModel.findById(item.product);
               if (prod && (prod as any).isPrepaidByPlatform) {
                 isCombo = true;
                 break;
               }
             }
          }
          if (isCombo) break;
        }
      }
      
      if (isCombo) {
        this.logger.log(`Skipping wallet credit for vendor on order ${fullOrder.orderNumber} because it is a pre-paid combo purchase.`);
        return;
      }

      // 1. Credit wallet for record keeping (Non-combo only)
      await this.walletsService.creditWallet(
        userId,
        vendorEarnings,
        `Earnings from order ${fullOrder.orderNumber}`,
        fullOrder._id.toString(),
      );

      // Instant payouts disabled as per new Daily Cron payout decision
      // const wantsInstant = wallet && wallet.payoutPreference === 'instant';
      const wantsInstant = false;

      if (wantsInstant) {
        // 2. Trigger instant withdrawal to bank account
        try {
          await this.walletsService.withdrawFunds(
            userId,
            vendorEarnings,
            vendorUser.email || 'vendor@erranders.com',
            `${vendorUser.firstName || 'Vendor'} ${vendorUser.lastName || ''}`.trim(),
            undefined,
            true // isInstant
          );
          this.logger.log(`Auto-payout initiated for vendor on order ${fullOrder.orderNumber}`);
        } catch (err: any) {
          // If payout fails (e.g. no bank account set), leave the funds in wallet
          this.logger.error(`Instant auto-payout failed for vendor on order ${fullOrder.orderNumber}: ${err.message}`);
        }
      } else {
        this.logger.log(`Funds retained in wallet for vendor on order ${fullOrder.orderNumber} (Instant Pref: ${wantsInstant})`);
      }
    }
  }

  private async processErranderPayout(order: Order): Promise<void> {
    const fullOrder = await this.orderModel.findById(order._id).populate('errander', 'user');
    if (!fullOrder || !fullOrder.errander) return;

    const erranderEarnings = (fullOrder.erranderPayout || fullOrder.deliveryFee) + ((fullOrder as any).tips || 0);
    
    if ((fullOrder.errander as any).user) {
      await this.walletsService.creditWallet(
        (fullOrder.errander as any).user.toString(),
        erranderEarnings,
        `Delivery fee from order ${fullOrder.orderNumber}`,
        fullOrder._id.toString(),
      );
    }
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
      if (order.hasRatedVendor) {
        throw new BadRequestException('Vendor has already been rated for this order');
      }
      order.vendorRating = data.vendorRating;
      order.vendorReview = data.vendorReview || '';
      order.hasRatedVendor = true;

      // Update Vendor Average Rating
      if (order.vendor) {
        const vendor = await this.vendorModel.findById(order.vendor);
        if (vendor) {
          const currentRating = vendor.rating || 5.0; // Default to 5.0 if not set
          const totalRatings = vendor.totalRatings || 0;
          const newTotalRatings = totalRatings + 1;
          
          vendor.rating = ((currentRating * totalRatings) + data.vendorRating) / newTotalRatings;
          vendor.totalRatings = newTotalRatings;
          await vendor.save();
        }
      }
    }

    if (data.erranderRating) {
      if (order.hasRatedErrander) {
        throw new BadRequestException('Errander has already been rated for this order');
      }
      order.erranderRating = data.erranderRating;
      order.erranderReview = data.erranderReview || '';
      order.hasRatedErrander = true;
      
      // Update Errander Average Rating
      if (order.errander) {
         const errander = await this.erranderModel.findOne({ user: new Types.ObjectId(order.errander.toString()) });
         if (errander) {
            // Very simple moving average calculation
            const currentRating = errander.rating || 0;
            const deliveries = errander.totalDeliveries || 1; 
            errander.rating = ((currentRating * (deliveries - 1)) + data.erranderRating) / deliveries;
            await errander.save();
         }
      }
      
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

    // Notify Support Team aggressively
    await this.notificationsService.notifySupportTeam(`User just cancelled order #${order.orderNumber}. Reason: ${reason}`);

    return order.populate([
      { path: 'customer', select: 'firstName lastName phone avatar' },
      { path: 'vendor', select: 'storeName logo phone' },
    ]);
  }

  async payWithWallet(orderId: string, customerId: string): Promise<Order> {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    
    if (order.customer.toString() !== customerId.toString()) {
      throw new ForbiddenException('You can only cancel your own orders');
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
    order.status = order.isPreOrder ? OrderStatus.SCHEDULED : OrderStatus.CONFIRMED;
    order.statusHistory.push({
      status: order.isPreOrder ? OrderStatus.SCHEDULED : OrderStatus.CONFIRMED,
      timestamp: new Date(),
      note: order.isPreOrder ? 'Order scheduled and paid via wallet balance' : 'Order paid via wallet balance',
    });
    
    await order.save();
    
    // Auto-payout vendor since payment is confirmed
    await this.processVendorPayout(order);
    
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
async getOrdersForVendorOwner(ownerId: string, status?: OrderStatus, page = 1, limit = 50) {
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
        await this.notificationsService.sendZavuSMS(phone, `Erranders Pickup Code for #${order.orderNumber}: ${otp}`, { forceSms: true });
      }
    } else {
      order.deliveryOtpHash = hash;
      const customer = order.customer as any;
      if (customer && customer.phone) {
        await this.notificationsService.sendZavuSMS(customer.phone, `Your Erranders Delivery Code for #${order.orderNumber} is: ${otp}. Do not share until delivery is complete.`, { forceSms: true });
      }
    }

    await order.save();
    return { 
      success: true, 
      message: 'OTP sent via SMS',
      method: 'sms'
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
    
    // Fallback: Just sending an SMS for now since Africa's Talking is removed.
    const msg = type === 'pickup' 
      ? `Erranders Pickup Code for #${order.orderNumber}: ${otp}`
      : `Your Erranders Delivery Code for #${order.orderNumber} is: ${otp}. Do not share until delivery is complete.`;
      
    await this.notificationsService.sendZavuSMS(phone, msg);
    
    return { 
      success: true, 
      message: 'OTP resent via SMS',
      method: 'sms' 
    };
  }

  async trackOrder(orderNumber: string, email: string) {
    const order = await this.orderModel.findOne({ orderNumber })
      .populate('vendor', 'storeName businessType businessName address logo')
      .populate('customer', 'firstName lastName email phone')
      .populate('errander', 'firstName lastName phone vehicleType')
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

    // Refund if paid
    if (order.paymentStatus === PaymentStatus.PAID) {
      await this.walletsService.creditWallet(
        order.customer._id ? order.customer._id.toString() : order.customer.toString(),
        order.total,
        `Refund for cancelled order #${order.orderNumber}`,
        order._id.toString()
      );
      order.paymentStatus = PaymentStatus.REFUNDED;
    }

    await order.save();

    if (order.vendor) {
      this.notifyOrderStatusUpdate(order, OrderStatus.CANCELLED, 'Order was cancelled by the customer.');
      
      // Notify Support Team aggressively
      this.notificationsService.notifySupportTeam(`User just cancelled tracked order #${order.orderNumber}. Reason: Cancelled by customer via tracking portal`);
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

    let errander = await this.erranderModel.findOne({
      user: new Types.ObjectId(erranderId),
    });
    
    if (!errander) {
      errander = await this.erranderModel.create({
        user: new Types.ObjectId(erranderId),
        status: ErranderStatus.OFFLINE,
      });
    }

    order.errander = errander._id;
    order.status = OrderStatus.AWAITING_PAYMENT;
    order.statusHistory.push({
      status: OrderStatus.AWAITING_PAYMENT,
      timestamp: new Date(),
      note: 'Errander accepted, awaiting student payment'
    });
    await order.save();

    // Broadcast order accepted so it is removed from the dispatch pool
    await this.redisService.publish('notification:broadcast:erranders', JSON.stringify({
      type: 'ORDER_ACCEPTED',
      data: { orderId: order._id.toString() }
    }));

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
    if (order.customer.toString() !== customerId.toString()) throw new BadRequestException('Not your order');
    if (order.status !== OrderStatus.AWAITING_PAYMENT) {
      throw new BadRequestException('Order is not awaiting payment');
    }

    const verification = await this.paystackService.verifyTransaction(paymentReference);
    if (verification?.status !== 'success') {
      throw new BadRequestException('Payment verification failed');
    }
    if (verification.amount < order.total - 5) {
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
    
    // Auto-payout vendor since payment is confirmed
    await this.processVendorPayout(order);

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
    const errandSetting = await this.settingModel.findOne({ key: 'custom_errand' }).exec();
    const commissionPercent = errandSetting?.value?.customErrandCommissionPercentage ?? 20;
    const commissionAmount = Math.round(newFee * (commissionPercent / 100)); 
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
    if (![OrderStatus.PENDING, OrderStatus.NEGOTIATING].includes(order.status as any)) throw new BadRequestException('Order is no longer accepting bids');

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
    if (![OrderStatus.PENDING, OrderStatus.NEGOTIATING].includes(order.status as any)) throw new BadRequestException('Order is no longer accepting bids');

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
    const errandSetting = await this.settingModel.findOne({ key: 'custom_errand' }).exec();
    const commissionPercent = errandSetting?.value?.customErrandCommissionPercentage ?? 20;
    const commissionAmount = Math.round(newFee * (commissionPercent / 100)); 
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

    order.errander = errander._id;
    order.status = OrderStatus.AWAITING_PAYMENT;
    order.statusHistory.push({
      status: OrderStatus.AWAITING_PAYMENT,
      timestamp: new Date(),
      note: 'Customer accepted a counter-offer bid, awaiting payment'
    });

    await order.save();
    
    // Broadcast order accepted so it is removed from the dispatch pool
    await this.redisService.publish('notification:broadcast:erranders', JSON.stringify({
      type: 'ORDER_ACCEPTED',
      data: { 
        orderId: order._id.toString(),
        winningUserId: bid.errander._id.toString()
      }
    }));
    
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

  async calculateDynamicFee(vendorId: string, customerId: string, deliveryAddress: string, deliveryLocationStr?: string, isWithinLuth?: boolean): Promise<number> {
    const vendor = await this.vendorModel.findById(vendorId);
    let user: any = null;
    if (customerId) {
      user = await this.userModel.findById(customerId);
    }
    
    // Fetch base delivery fee from admin system settings
    const customErrandSetting = await this.settingModel.findOne({ key: 'custom_errand' }).exec();
    const baseFare = customErrandSetting?.value?.baseFee || 350;
    let fallbackFee = baseFare;

    if (!vendor) return fallbackFee;

    const vendorLocation = vendor.location?.coordinates;
    let customerLocation = user?.location?.coordinates;

    if (deliveryLocationStr) {
      try {
        const parsed = JSON.parse(deliveryLocationStr);
        if (parsed && parsed.coordinates) {
          customerLocation = parsed.coordinates;
        }
      } catch (e) {
        this.logger.warn(`Failed to parse deliveryLocationStr: ${deliveryLocationStr}`);
      }
    }

    // Check if vendor location is missing or default [0,0]
    if (!vendorLocation || (vendorLocation[0] === 0 && vendorLocation[1] === 0)) {
      // Try geocoding vendor address
      if (vendor.address) {
         const geocoded = await this.mapboxService.geocode(vendor.address);
         if (geocoded) {
           vendor.location = { type: 'Point', coordinates: geocoded };
           await vendor.save();
         }
      }
    }

    // Check if customer location is missing or default [0,0]
    if (!customerLocation || (customerLocation[0] === 0 && customerLocation[1] === 0)) {
      if (deliveryAddress) {
         const geocoded = await this.mapboxService.geocode(deliveryAddress);
         if (geocoded) {
           customerLocation = geocoded;
           if (user) {
             user.location = { type: 'Point', coordinates: geocoded };
             user.deliveryAddress = deliveryAddress;
             await user.save();
           }
         }
      }
    }

    const vCoords = vendor.location?.coordinates;

    // Check if customer is within CMUL/LUTH Idi-Araba Campus (Flat Rate ₦300)
    let isCMUL = false;
    if (customerLocation && customerLocation[0] !== 0 && customerLocation[1] !== 0) {
      const [lng, lat] = customerLocation;
      // Widen bounding box significantly to account for mapbox inaccuracies in Nigeria
      const isWithinLat = lat >= 6.440000 && lat <= 6.530000;
      const isWithinLng = lng >= 3.340000 && lng <= 3.400000;
      if (isWithinLat && isWithinLng) {
        // If it falls in the broad area, we MUST still verify with string because the box is large
        // So we won't auto-set isCMUL based purely on this widened box.
        // We'll rely more on the string matching.
      }
    }

    if (isWithinLuth) {
      isCMUL = true;
    } else {
      // String fallback because Mapbox coordinates for Nigerian institutions can be wildly inaccurate
      const addrLower = (deliveryAddress || '').toLowerCase();
      if (
        addrLower.includes('college of medicine') || 
        addrLower.includes('luth') || 
        addrLower.includes('lagos university teaching hospital') ||
        addrLower.includes('idi araba') || 
        addrLower.includes('idi-araba') ||
        addrLower.includes('cmul') ||
        addrLower.includes('medilag') ||
        addrLower.includes('unilag') ||
        addrLower.includes('block') ||
        addrLower.includes('hostel') ||
        addrLower.includes('hall')
      ) {
        isCMUL = true;
      }
    }

    if (isCMUL) {
      return baseFare;
    }

    if (vCoords && vCoords[0] !== 0 && customerLocation && customerLocation[0] !== 0) {
       const distanceKm = await this.mapboxService.getDrivingDistance(
         vCoords as [number, number],
         customerLocation as [number, number]
       );

       if (distanceKm !== null) {
          // Cap delivery fee at ₦1,500 max. If distance is unreasonably high (>30km), fallback to base fare.
          if (distanceKm > 30) {
            return baseFare;
          }
          const extraDist = Math.max(0, distanceKm - 1);
          let fee = baseFare + (extraDist * 100);
          return Math.min(1500, Math.round(fee));
       }
    }

    return fallbackFee;
  }

  /**
   * Errander submits the actual item cost after purchasing items.
   * Triggers reconciliation flow: if actual < estimated, refund is calculated.
   */
  async submitReconciliation(
    orderId: string,
    erranderId: string,
    data: { actualItemCost: number; receiptImage?: string; note?: string },
  ): Promise<Order> {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.type !== OrderType.CUSTOM_ERRAND) {
      throw new BadRequestException('Reconciliation is only available for custom errands');
    }
    const erranderProfile = await this.erranderModel.findOne({ user: erranderId });
    if (!erranderProfile) {
      throw new BadRequestException('Errander profile not found');
    }

    if (!order.errander || (order.errander.toString() !== erranderProfile._id.toString() && order.errander.toString() !== erranderProfile.user.toString())) {
      throw new BadRequestException('Only the assigned errander can submit reconciliation');
    }
    if (order.reconciliationStatus === 'approved') {
      throw new BadRequestException('Reconciliation has already been approved');
    }
    if (!data.actualItemCost || data.actualItemCost < 0) {
      throw new BadRequestException('Actual item cost must be a positive number');
    }

    const estimatedCost = order.customDetails?.estimatedItemCost || 0;
    const difference = estimatedCost - data.actualItemCost;

    order.actualItemCost = data.actualItemCost;
    order.receiptImage = data.receiptImage || '';
    order.reconciliationNote = data.note || '';
    order.reconciliationStatus = 'submitted';
    order.refundAmount = difference > 0 ? difference : 0;

    await order.save();

    // Notify customer about reconciliation
    const customerId = order.customer?._id || order.customer;
    if (customerId) {
      const message = difference > 0
        ? `Your rider submitted the actual cost of ₦${data.actualItemCost.toLocaleString()} for order #${order.orderNumber}. A refund of ₦${difference.toLocaleString()} will be credited once you approve.`
        : difference < 0
          ? `Your rider submitted the actual cost of ₦${data.actualItemCost.toLocaleString()} for order #${order.orderNumber}. The item cost was ₦${Math.abs(difference).toLocaleString()} more than estimated. The rider covered the difference.`
          : `Your rider confirmed the item cost of ₦${data.actualItemCost.toLocaleString()} for order #${order.orderNumber} matches the estimate. Please approve.`;

      try {
        await this.notificationsService.sendNotification(customerId.toString(), {
          type: 'ORDER_UPDATE',
          title: 'Item Cost Reconciliation',
          body: message,
          data: { orderId: order._id, orderNumber: order.orderNumber, refundAmount: order.refundAmount },
        });
        this.notificationsGateway.sendToUser(customerId.toString(), {
          title: 'Item Cost Reconciliation',
          body: message,
          type: 'RECONCILIATION_SUBMITTED',
          data: {
            orderId: order._id,
            orderNumber: order.orderNumber,
            actualItemCost: data.actualItemCost,
            estimatedItemCost: estimatedCost,
            refundAmount: order.refundAmount,
          }
        });
      } catch (e) {
        this.logger.warn(`Failed to notify customer about reconciliation: ${e}`);
      }
    }

    this.logger.log(`Reconciliation submitted for order ${order.orderNumber}: estimated ₦${estimatedCost}, actual ₦${data.actualItemCost}, refund ₦${order.refundAmount}`);
    return order;
  }

  /**
   * Customer approves the reconciliation. If overpaid, refund the difference to their wallet.
   */
  async approveReconciliation(orderId: string, customerId: string): Promise<Order> {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    
    const orderCustomerId = (order.customer?._id || order.customer)?.toString();
    if (orderCustomerId !== customerId) {
      throw new BadRequestException('Only the customer can approve reconciliation');
    }
    if (order.reconciliationStatus !== 'submitted') {
      throw new BadRequestException('No pending reconciliation to approve');
    }

    order.reconciliationStatus = 'approved';
    await order.save();

    // If customer overpaid, refund the difference to their wallet
    if (order.refundAmount && order.refundAmount > 0) {
      try {
        await this.walletsService.creditWallet(
          customerId,
          order.refundAmount,
          `Refund: Item cost reconciliation for order #${order.orderNumber} (estimated ₦${order.customDetails?.estimatedItemCost?.toLocaleString()}, actual ₦${order.actualItemCost?.toLocaleString()})`,
          order._id.toString(),
        );
        this.logger.log(`Refunded ₦${order.refundAmount} to customer ${customerId} for order ${order.orderNumber}`);

        // Notify customer
        try {
          await this.notificationsService.sendNotification(customerId.toString(), {
            type: 'ORDER_UPDATE',
            title: 'Refund Credited',
            body: `₦${order.refundAmount.toLocaleString()} has been credited to your wallet for order #${order.orderNumber}.`,
            data: { orderId: order._id, orderNumber: order.orderNumber },
          });
          this.notificationsGateway.sendToUser(customerId.toString(), {
            title: 'Refund Credited',
            body: `₦${order.refundAmount.toLocaleString()} has been credited to your wallet for order #${order.orderNumber}.`,
            type: 'REFUND_CREDITED',
            data: {
              orderId: order._id,
              amount: order.refundAmount,
            }
          });
        } catch (e) {
          this.logger.warn(`Failed to notify customer about refund: ${e}`);
        }
      } catch (e) {
        this.logger.error(`Failed to credit refund for order ${order.orderNumber}: ${e}`);
        throw new BadRequestException('Refund failed. Please contact support.');
      }
    }

    return order;
  }

  // --- ERRAND POOLING (CUSTOM ERRANDS) ---

  async recordOrderView(orderId: string, erranderId: string): Promise<any> {
    const order = await this.orderModel.findById(orderId).populate('viewers.errander', 'firstName lastName avatar phone rating');
    if (!order) throw new NotFoundException('Order not found');

    const hasViewed = order.viewers.some((v: any) => v.errander?._id?.toString() === erranderId.toString());
    
    if (!hasViewed) {
      const errander = await this.userModel.findById(erranderId);
      if (errander) {
        order.viewers.push({
          errander: errander._id,
          timestamp: new Date()
        });
        await order.save();

        const populatedOrder = await this.orderModel.findById(orderId).populate('viewers.errander', 'firstName lastName avatar phone rating').lean();

        // Notify customer via push notification
        const customerId = (order.customer as any)?._id?.toString() || order.customer?.toString();
        
        try {
          await this.notificationsService.sendNotification(customerId, {
            type: 'ORDER_UPDATE',
            title: 'Rider is viewing your request',
            body: `${errander.firstName} ${errander.lastName} is currently viewing your custom errand request!`,
            data: { orderId: order._id, orderNumber: order.orderNumber },
          });

          this.notificationsGateway.sendToUser(customerId, {
            title: 'Rider Viewing Request',
            body: `${errander.firstName} ${errander.lastName} is currently viewing your custom errand request!`,
            type: 'ERRAND_VIEWER_ADDED',
            data: {
              orderId: order._id,
              viewers: populatedOrder?.viewers || []
            }
          });
        } catch (e) {
          this.logger.warn(`Failed to notify customer about order view: ${e}`);
        }

        return populatedOrder;
      }
    }
    
    return order;
  }

  async createErrandPool(orderId: string, customerId: string, title: string, maxParticipants = 4): Promise<any> {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    
    const orderCustomerId = (order.customer as any)?._id?.toString() || order.customer?.toString();
    if (orderCustomerId !== customerId.toString()) throw new BadRequestException('Not authorized');
    
    if (order.type !== 'custom_errand') throw new BadRequestException('Only custom errands can be pooled');
    if (order.isPooledErrand) throw new BadRequestException('Order is already in a pool');

    const poolCode = 'POOL-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const pool = await this.errandPoolModel.create({
      poolCode,
      title,
      creator: customerId,
      orders: [order._id],
      baseDeliveryFee: order.deliveryFee,
      maxParticipants,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour expiry
    });

    order.isPooledErrand = true;
    order.errandPoolId = pool._id;
    await order.save();

    return pool;
  }

  async getOpenPools(): Promise<any[]> {
    return this.errandPoolModel.find({ status: 'open' })
      .populate('creator', 'firstName lastName avatar')
      .populate('orders')
      .sort({ createdAt: -1 })
      .lean();
  }

  async joinPool(poolId: string, orderId: string, customerId: string): Promise<any> {
    const pool = await this.errandPoolModel.findById(poolId);
    if (!pool) throw new NotFoundException('Pool not found');
    if (pool.status !== 'open') throw new BadRequestException('Pool is no longer open');
    if (pool.orders.length >= pool.maxParticipants) throw new BadRequestException('Pool is full');

    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.customer.toString() !== customerId) throw new BadRequestException('Not authorized');
    if (order.type !== 'custom_errand') throw new BadRequestException('Only custom errands can be pooled');
    if (order.isPooledErrand) throw new BadRequestException('Order is already in a pool');

    // Add to pool
    pool.orders.push(order._id);
    await pool.save();

    order.isPooledErrand = true;
    order.errandPoolId = pool._id;
    
    // Calculate split fee
    const currentParticipantCount = pool.orders.length;
    const splitFee = Math.floor(pool.baseDeliveryFee / currentParticipantCount);
    
    order.deliveryFee = splitFee;
    await order.save();

    // Issue refunds to previous participants for the difference
    for (const memberOrderId of pool.orders) {
      if (memberOrderId.toString() === order._id.toString()) continue; // Skip new member

      const memberOrder = await this.orderModel.findById(memberOrderId);
      if (memberOrder && memberOrder.deliveryFee > splitFee) {
        const refundDiff = memberOrder.deliveryFee - splitFee;
        memberOrder.deliveryFee = splitFee;
        await memberOrder.save();
        
        try {
          await this.walletsService.creditWallet(
            memberOrder.customer.toString(),
            refundDiff,
            `Delivery Fee Refund: Shared Pool (${pool.title}) adjusted fee`,
            memberOrder._id.toString()
          );
        } catch (e) {
          this.logger.error(`Failed to refund pool discount for order ${memberOrder.orderNumber}: ${e}`);
        }
      }
    }

    if (pool.orders.length >= pool.maxParticipants) {
      pool.status = 'locked'; // Auto lock if full
      await pool.save();
    }

    return pool;
  }

  async lockPool(poolId: string, customerId: string): Promise<any> {
    const pool = await this.errandPoolModel.findById(poolId);
    if (!pool) throw new NotFoundException('Pool not found');
    if (pool.creator.toString() !== customerId) throw new BadRequestException('Only the creator can lock the pool');
    if (pool.status !== 'open') throw new BadRequestException('Pool is already locked or completed');

    pool.status = 'locked';
    await pool.save();

    return pool;
  }

  async updateOrderDeliveryDate(orderId: string, newDate: Date) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    order.scheduledTime = newDate;
    order.status = OrderStatus.CONFIRMED;
    await order.save();

    if (order.paymentStatus === PaymentStatus.PAID) {
      await this.broadcastNewOrderToErranders(order);
    }
  }
}
