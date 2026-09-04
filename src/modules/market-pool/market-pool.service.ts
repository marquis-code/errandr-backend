import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MarketPoolCampaign, MarketPoolCampaignStatus } from './schemas/market-pool-campaign.schema';
import { MarketPoolItem } from './schemas/market-pool-item.schema';
import { MarketPoolOrder, MarketPoolOrderStatus } from './schemas/market-pool-order.schema';
import { MarketPoolCustomRequest } from './schemas/market-pool-custom-request.schema';
import { MarketPoolCategory } from './schemas/market-pool-category.schema';
import { WalletsService } from '../wallets/wallets.service';
import { SystemSetting } from '../admin/schemas/system-setting.schema';
import { EmailService } from '../email/email.service';
import { User } from '../users/schemas/user.schema';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MarketPoolService {
  private readonly logger = new Logger(MarketPoolService.name);

  constructor(
    @InjectModel(MarketPoolCampaign.name) private campaignModel: Model<MarketPoolCampaign>,
    @InjectModel(MarketPoolItem.name) private itemModel: Model<MarketPoolItem>,
    @InjectModel(MarketPoolOrder.name) private orderModel: Model<MarketPoolOrder>,
    @InjectModel(MarketPoolCustomRequest.name) private customRequestModel: Model<MarketPoolCustomRequest>,
    @InjectModel(MarketPoolCategory.name) private categoryModel: Model<MarketPoolCategory>,
    @InjectModel(SystemSetting.name) private systemSettingModel: Model<SystemSetting>,
    @InjectModel(User.name) private userModel: Model<User>,
    private walletsService: WalletsService,
    private emailService: EmailService,
    private notificationsService: NotificationsService,
  ) {}

  async getCategories(): Promise<MarketPoolCategory[]> {
    let categories = await this.categoryModel.find().sort({ name: 1 });
    if (categories.length === 0) {
      const defaultCategories = [
        'Foodstuffs',
        'Proteins',
        'Provisions',
        'Vegetables & Fruits',
        'Spices & Oils',
        'Snacks & Drinks',
        'Grains & Cereals',
        'Meat & Poultry',
        'Seafood',
        'Dairy & Alternatives',
        'Bakery',
        'Condiments & Sauces',
        'Beverages',
        'Frozen Foods',
        'Household & Cleaning',
        'Personal Care',
        'Others'
      ];
      await this.categoryModel.insertMany(defaultCategories.map(name => ({ name })));
      categories = await this.categoryModel.find().sort({ name: 1 });
    }
    return categories;
  }

  async addCategory(name: string): Promise<MarketPoolCategory> {
    const existing = await this.categoryModel.findOne({ name });
    if (existing) {
      return existing;
    }
    return this.categoryModel.create({ name });
  }

  async updateCategory(id: string, name: string): Promise<MarketPoolCategory> {
    const category = await this.categoryModel.findByIdAndUpdate(id, { name }, { new: true });
    if (!category) {
      throw new NotFoundException(`Category ${id} not found`);
    }
    // Also update any items that used this category
    const oldCategory = await this.categoryModel.findById(id);
    if (oldCategory && oldCategory.name !== name) {
        await this.itemModel.updateMany({ category: oldCategory.name }, { category: name });
    }
    return category;
  }

  async deleteCategory(id: string): Promise<void> {
    await this.categoryModel.findByIdAndDelete(id);
  }

  async createCampaign(title: string, startDate: Date, endDate: Date): Promise<MarketPoolCampaign> {
    return this.campaignModel.create({ title, startDate, endDate });
  }

  async getActiveCampaign(): Promise<MarketPoolCampaign | null> {
    return this.campaignModel.findOne({ status: MarketPoolCampaignStatus.OPEN }).sort({ createdAt: -1 });
  }

  async addItem(campaignId: string, data: any): Promise<MarketPoolItem> {
    return this.itemModel.create({ campaignId, ...data });
  }

  async updateItem(itemId: string, data: any): Promise<MarketPoolItem> {
    const item = await this.itemModel.findByIdAndUpdate(itemId, data, { new: true });
    if (!item) {
      throw new NotFoundException(`Item ${itemId} not found`);
    }
    return item;
  }

  async getCampaignItems(campaignId: string): Promise<MarketPoolItem[]> {
    return this.itemModel.find({ campaignId });
  }

  async checkout(
    userId: string, 
    campaignId: string, 
    items: { itemId: string, quantity: number, preferences?: string }[],
    deliveryDetails?: { deliverySlot?: string, proxyName?: string, proxyPhone?: string }
  ): Promise<MarketPoolOrder> {
    const campaign = await this.campaignModel.findById(campaignId);
    if (!campaign || campaign.status !== MarketPoolCampaignStatus.OPEN) {
      throw new BadRequestException('Campaign is not open');
    }

    let totalItemCost = 0;
    const orderItems: any[] = [];

    for (const item of items) {
      const dbItem = await this.itemModel.findById(item.itemId);
      if (!dbItem) throw new NotFoundException(`Item ${item.itemId} not found`);
      totalItemCost += dbItem.appPrice * item.quantity;
      orderItems.push({
        itemId: dbItem._id,
        quantity: item.quantity,
        priceAtPurchase: dbItem.appPrice,
        preferences: item.preferences || '',
      });

      // Increment currentQuantity for gamification/milestones
      dbItem.currentQuantity += item.quantity;
      await dbItem.save();
    }

    const deliveryFee = 500; // Flat delivery fee
    const total = totalItemCost + deliveryFee;

    // We no longer deduct from wallet here. Order goes into PENDING_PAYMENT

    return this.orderModel.create({
      campaignId,
      userId,
      items: orderItems,
      totalItemCost,
      deliveryFee,
      deliverySlot: deliveryDetails?.deliverySlot || 'morning',
      proxyName: deliveryDetails?.proxyName || '',
      proxyPhone: deliveryDetails?.proxyPhone || '',
      status: MarketPoolOrderStatus.PENDING_PAYMENT,
    });
  }

  async getPaymentDetails() {
    const setting = await this.systemSettingModel.findOne({ key: 'market_pool_bank_account' });
    if (!setting) {
      return { bankName: '', accountNumber: '', accountName: '' };
    }
    return setting.value;
  }

  async uploadProof(orderId: string, userId: string, paymentProofUrl: string): Promise<MarketPoolOrder> {
    const order = await this.orderModel.findOne({ _id: orderId, userId });
    if (!order) throw new NotFoundException('Order not found');

    if (order.status !== MarketPoolOrderStatus.PENDING_PAYMENT && order.status !== MarketPoolOrderStatus.PAYMENT_VERIFYING) {
      throw new BadRequestException('Order is not in a valid state for payment proof upload');
    }

    order.paymentProofUrl = paymentProofUrl;
    order.status = MarketPoolOrderStatus.PAYMENT_VERIFYING;
    await order.save();
    
    // Notify admin
    const user = await this.userModel.findById(userId);
    if (user) {
      await this.emailService.sendMarketPoolPaymentUploadedEmail(order._id.toString(), `${user.firstName} ${user.lastName}`, paymentProofUrl);
    }

    return order;
  }

  async verifyPayment(orderId: string, action: 'approve' | 'reject'): Promise<MarketPoolOrder> {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    if (action === 'approve') {
      order.status = MarketPoolOrderStatus.PAID;
      // Notify student
      const user = await this.userModel.findById(order.userId);
      if (user) {
        await this.emailService.sendMarketPoolPaymentVerifiedEmail(order._id.toString(), `${user.firstName} ${user.lastName}`);
      }
    } else {
      order.status = MarketPoolOrderStatus.PENDING_PAYMENT;
      order.paymentProofUrl = ''; // Clear rejected proof
    }

    await order.save();
    return order;
  }

  async updateOrderStatus(campaignId: string, status: MarketPoolOrderStatus): Promise<void> {
    await this.orderModel.updateMany({ campaignId, status: { $ne: MarketPoolOrderStatus.PARTIALLY_REFUNDED } }, { status });
    
    // Fetch affected orders to notify students
    const orders = await this.orderModel.find({ campaignId, status }).populate('userId');
    
    for (const order of orders) {
      const user = order.userId as any;
      if (user) {
        const formattedStatus = status.replace(/_/g, ' ');
        
        // Send Push Notification
        if (user.fcmToken) {
          await this.notificationsService.sendPushNotification(user.fcmToken, {
            title: `Market Pool Update`,
            body: `Your order #${order._id.toString().slice(-6)} is now ${formattedStatus}!`,
            data: { type: 'market_pool_update', orderId: order._id.toString() }
          }).catch(e => this.logger.error(`Failed to send push to ${user.email}`, e));
        }
        
        // Send Email
        await this.emailService.sendMarketPoolStatusUpdateEmail(
          order._id.toString(),
          `${user.firstName} ${user.lastName}`,
          status,
          user.email
        ).catch(e => this.logger.error(`Failed to send email to ${user.email}`, e));
      }
    }
  }

  async addReview(itemId: string, userId: string, rating: number, comment: string): Promise<MarketPoolItem> {
    const item = await this.itemModel.findByIdAndUpdate(
      itemId,
      { $push: { reviews: { userId: new Types.ObjectId(userId), rating, comment } } },
      { new: true }
    );
    if (!item) {
      throw new NotFoundException(`Item ${itemId} not found`);
    }
    return item;
  }

  async refundItem(campaignId: string, itemId: string): Promise<void> {
    const orders = await this.orderModel.find({ campaignId, status: MarketPoolOrderStatus.PAID });
    for (const order of orders) {
      const orderItem = order.items.find(i => i.itemId.toString() === itemId);
      if (orderItem) {
        const refundAmount = orderItem.priceAtPurchase * orderItem.quantity;
        await this.walletsService.fundWalletByAdmin(
          order.userId.toString(),
          refundAmount,
          `Refund for unavailable market pool item`
        );
        order.status = MarketPoolOrderStatus.PARTIALLY_REFUNDED;
        await order.save();
      }
    }
  }

  async createCustomRequest(userId: string, campaignId: string, data: any): Promise<MarketPoolCustomRequest> {
    return this.customRequestModel.create({
      userId,
      campaignId,
      ...data,
    });
  }

  async getCustomRequests(campaignId: string): Promise<MarketPoolCustomRequest[]> {
    return this.customRequestModel.find({ campaignId }).populate('userId', 'name email phone').sort({ createdAt: -1 });
  }

  async getAggregation(campaignId: string): Promise<any> {
    return this.orderModel.aggregate([
      { $match: { campaignId: new Types.ObjectId(campaignId), status: { $ne: 'refunded' } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.itemId',
          totalQuantity: { $sum: '$items.quantity' },
        },
      },
      {
        $lookup: {
          from: 'marketpoolitems',
          localField: '_id',
          foreignField: '_id',
          as: 'item',
        },
      },
      { $unwind: '$item' },
    ]);
  }

  async getUserOrders(userId: string): Promise<any[]> {
    const orders = await this.orderModel.find({ userId }).sort({ createdAt: -1 }).lean();
    for (const order of orders) {
      for (const item of order.items) {
        item['itemDetails'] = await this.itemModel.findById(item.itemId).lean();
      }
    }
    return orders;
  }

  async getCampaignOrders(campaignId: string): Promise<any[]> {
    const orders = await this.orderModel.find({ campaignId })
      .populate('userId', 'name email phone')
      .sort({ createdAt: -1 })
      .lean();
    for (const order of orders) {
      for (const item of order.items) {
        item['itemDetails'] = await this.itemModel.findById(item.itemId).lean();
      }
    }
    return orders;
  }
}
