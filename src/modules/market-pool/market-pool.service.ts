import { Injectable, NotFoundException, BadRequestException, Logger, Inject, forwardRef } from '@nestjs/common';
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
import { InstitutionResolver } from '../institutions/institution-resolver.service';

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
    @Inject(forwardRef(() => WalletsService)) private walletsService: WalletsService,
    private emailService: EmailService,
    private notificationsService: NotificationsService,
    private institutionResolver: InstitutionResolver,
  ) {}

  /**
   * Campus tenancy. Returns the institution every result of a request must be
   * restricted to, or `null` when the request must not be scoped (guests and
   * legacy clients) — in which case the caller leaves its query untouched.
   */
  private async resolveInstitution(req?: any): Promise<Types.ObjectId | null> {
    if (!req) return null;
    return this.institutionResolver.resolve(req);
  }

  /**
   * Campaign tenancy filter. Campaigns created without a campus (every campaign
   * that exists today) stay global, so nothing disappears for legacy clients.
   */
  private campaignInstitutionFilter(institution: Types.ObjectId | null): any {
    if (!institution) return {};
    return {
      $or: [
        { institution },
        { institution: { $exists: false } },
        { institution: null },
      ],
    };
  }

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

  async createCampaign(title: string, startDate: Date, endDate: Date, req?: any): Promise<MarketPoolCampaign> {
    // Stamp the creating admin's campus when there is one; otherwise the
    // campaign stays global (legacy behaviour).
    const institution = await this.resolveInstitution(req);
    return this.campaignModel.create({
      title,
      startDate,
      endDate,
      ...(institution ? { institution } : {}),
    });
  }

  async closeCampaign(id: string): Promise<MarketPoolCampaign> {
    const campaign = await this.campaignModel.findById(id);
    if (!campaign) {
      throw new NotFoundException(`Campaign ${id} not found`);
    }
    campaign.status = MarketPoolCampaignStatus.CLOSED;
    return campaign.save();
  }

  async getActiveCampaign(req?: any): Promise<MarketPoolCampaign | null> {
    const institution = await this.resolveInstitution(req);
    return this.campaignModel
      .findOne({ status: MarketPoolCampaignStatus.OPEN, ...this.campaignInstitutionFilter(institution) })
      .sort({ createdAt: -1 });
  }

  async getActiveCampaigns(req?: any): Promise<MarketPoolCampaign[]> {
    const institution = await this.resolveInstitution(req);
    return this.campaignModel
      .find({ status: MarketPoolCampaignStatus.OPEN, ...this.campaignInstitutionFilter(institution) })
      .sort({ createdAt: -1 });
  }

  async getAllCampaigns(req?: any): Promise<MarketPoolCampaign[]> {
    const institution = await this.resolveInstitution(req);
    return this.campaignModel
      .find(this.campaignInstitutionFilter(institution))
      .sort({ createdAt: -1 });
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

    const configSetting = await this.systemSettingModel.findOne({ key: 'market_pool_config' }).exec();
    const config = configSetting?.value || { feeType: 'flat', feeValue: 500 };
    
    let deliveryFee = 500; // default fallback
    if (config.feeType === 'percentage') {
      deliveryFee = Math.round((totalItemCost * config.feeValue) / 100);
    } else {
      deliveryFee = config.feeValue;
    }
    
    const total = totalItemCost + deliveryFee;

    // We no longer deduct from wallet here. Order goes into PENDING_PAYMENT

    // Campus tenancy: stamp the ordering student's institution (unset when the
    // student has none — never invented).
    const orderingUser = Types.ObjectId.isValid(userId)
      ? await this.userModel.findById(userId).select('institution').lean()
      : null;
    const institution = (orderingUser as any)?.institution || undefined;

    return this.orderModel.create({
      campaignId,
      userId,
      institution,
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

  async updateDeliveryPreference(
    orderId: string, 
    userId: string, 
    deliverySlot?: string, 
    proxyName?: string, 
    proxyPhone?: string
  ): Promise<MarketPoolOrder> {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId.toString() !== userId) throw new BadRequestException('Unauthorized');

    const uneditableStatuses = [
      MarketPoolOrderStatus.OUT_FOR_DELIVERY,
      MarketPoolOrderStatus.DELIVERED
    ];

    if (uneditableStatuses.includes(order.status as MarketPoolOrderStatus)) {
      throw new BadRequestException('Order delivery preference can no longer be edited at this stage');
    }

    if (deliverySlot !== undefined) order.deliverySlot = deliverySlot;
    if (proxyName !== undefined) order.proxyName = proxyName;
    if (proxyPhone !== undefined) order.proxyPhone = proxyPhone;

    await order.save();
    return order;
  }

  
  async payForOrder(orderId: string, userId: string, paymentReference: string): Promise<MarketPoolOrder> {
    // Webhook may pass userId='SYSTEM', so fallback to orderId-only lookup
    let order = await this.orderModel.findOne({ _id: orderId, userId });
    if (!order && userId === 'SYSTEM') {
      order = await this.orderModel.findById(orderId);
    }
    if (!order) throw new NotFoundException('Order not found');

    if (order.status !== MarketPoolOrderStatus.PENDING_PAYMENT) {
      throw new BadRequestException('Order is already paid or not in valid state');
    }

    order.paymentReference = paymentReference;
    order.status = MarketPoolOrderStatus.PAID;
    await order.save();
    
    // Notify student
    const user = await this.userModel.findById(userId);
    if (user) {
      await this.emailService.sendMarketPoolPaymentVerifiedEmail(order._id.toString(), `${user.firstName} ${user.lastName}`);
    }

    return order;
  }

  async payWithWallet(orderId: string, userId: string): Promise<MarketPoolOrder> {
    const order = await this.orderModel.findOne({ _id: orderId, userId });
    if (!order) throw new NotFoundException('Order not found');

    if (order.status !== MarketPoolOrderStatus.PENDING_PAYMENT) {
      throw new BadRequestException('Order is already paid or not in valid state');
    }

    const totalAmount = order.totalItemCost + order.deliveryFee;

    await this.walletsService.debitWallet(
      userId,
      totalAmount,
      `Market Pool Order Payment (#${orderId.slice(-6)})`
    );

    order.status = MarketPoolOrderStatus.PAID;
    order.paymentReference = 'WALLET';
    await order.save();
    
    const user = await this.userModel.findById(userId);
    if (user) {
      await this.emailService.sendMarketPoolPaymentVerifiedEmail(order._id.toString(), `${user.firstName} ${user.lastName}`);
    }

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

  async getAggregation(campaignId: string, req?: any): Promise<any> {
    const institution = await this.resolveInstitution(req);
    return this.orderModel.aggregate([
      {
        $match: {
          campaignId: new Types.ObjectId(campaignId),
          status: { $ne: 'refunded' },
          ...this.campaignInstitutionFilter(institution),
        },
      },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$items.itemId',
          totalQuantity: { $sum: '$items.quantity' },
          students: {
            $push: {
              userId: '$userId',
              firstName: '$user.firstName',
              lastName: '$user.lastName',
              quantity: '$items.quantity',
            },
          },
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

  async getUserOrders(userId: string, req?: any): Promise<any[]> {
    const filter: any = { userId };
    // Campus tenancy: the caller's own orders, restricted to their campus.
    // Un-stamped legacy orders stay visible to their owner.
    const institution = await this.resolveInstitution(req);
    if (institution) {
      filter.$or = [
        { institution },
        { institution: { $exists: false } },
        { institution: null },
      ];
    }

    const orders = await this.orderModel.find(filter).sort({ createdAt: -1 }).lean();
    for (const order of orders) {
      for (const item of order.items) {
        item['itemDetails'] = await this.itemModel.findById(item.itemId).lean();
      }
    }
    return orders;
  }

  async getCampaignOrders(campaignId: string, req?: any): Promise<any[]> {
    const filter: any = { campaignId };
    // Campus tenancy: an admin listing is scoped like any other list; campaigns
    // created without a campus stay visible everywhere.
    const institution = await this.resolveInstitution(req);
    if (institution) {
      filter.$or = [
        { institution },
        { institution: { $exists: false } },
        { institution: null },
      ];
    }

    const orders = await this.orderModel.find(filter)
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
