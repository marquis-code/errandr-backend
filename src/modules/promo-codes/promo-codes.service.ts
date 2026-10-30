import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PromoCode } from './schemas/promo-code.schema';
import { PromoRedemption } from './schemas/promo-redemption.schema';
import { User, UserRole } from '../users/schemas/user.schema';
import { Facilitator, FacilitatorTier } from '../referrals/schemas/facilitator.schema';
import { Referral, ReferralStatus, ReferrerType, ReferredType } from '../referrals/schemas/referral.schema';
import { Order, OrderStatus } from '../orders/schemas/order.schema';
import { WalletsService } from '../wallets/wallets.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class PromoCodesService {
  private readonly logger = new Logger(PromoCodesService.name);

  constructor(
    @InjectModel(PromoCode.name) private readonly promoCodeModel: Model<PromoCode>,
    @InjectModel(PromoRedemption.name) private readonly promoRedemptionModel: Model<PromoRedemption>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Facilitator.name) private readonly facilitatorModel: Model<Facilitator>,
    @InjectModel(Referral.name) private readonly referralModel: Model<Referral>,
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
    @Inject(forwardRef(() => WalletsService)) private readonly walletsService: WalletsService,
    private readonly emailService: EmailService,
  ) {}

  async create(data: any): Promise<PromoCode> {
    const rawCode = (data.code || '').trim().toUpperCase();
    if (!rawCode) {
      throw new BadRequestException('Promo code string is required');
    }

    const existing = await this.promoCodeModel.findOne({ code: rawCode });
    if (existing) {
      throw new BadRequestException('Promo code already exists');
    }

    // Auto-detect & link referrer if provided
    let referrerType = data.referrerType || 'none';
    let isReferralPromo = !!data.isReferralPromo;

    if (data.referrerFacilitator) {
      referrerType = 'facilitator';
      isReferralPromo = true;
    } else if (data.referrerUser) {
      const user = await this.userModel.findById(data.referrerUser);
      if (user) {
        referrerType = user.role; // 'errander' | 'student' | 'vendor'
        isReferralPromo = true;
      }
    }

    const promo = new this.promoCodeModel({
      ...data,
      code: rawCode,
      referrerType,
      isReferralPromo,
      rewardPerUse: data.rewardPerUse !== undefined ? Number(data.rewardPerUse) : 50,
      rewardType: data.rewardType || 'points',
    });

    const savedPromo = await promo.save();

    // 1. Notify targeted specific users if applicableUsers list is provided
    if (data.applicableUsers && data.applicableUsers.length > 0) {
      this.userModel.find({ _id: { $in: data.applicableUsers } }).then(users => {
        users.forEach(user => {
          if (user.email) {
            const discountText = savedPromo.discountType === 'percentage' 
              ? `${savedPromo.value}% OFF` 
              : `₦${savedPromo.value} OFF`;
            
            const htmlContent = `
              <div style="font-family: sans-serif; padding: 20px;">
                <h2>Hello ${user.firstName},</h2>
                <p>A special promo code has just been generated for you!</p>
                <div style="background: #FF5C1A; color: #fff; padding: 15px; border-radius: 8px; font-size: 24px; text-align: center; letter-spacing: 2px; font-weight: bold; margin: 20px 0;">
                  ${savedPromo.code}
                </div>
                <p>Use this code to get <strong>${discountText}</strong> on your next order!</p>
                ${savedPromo.expiresAt ? `<p><em>Valid until: ${new Date(savedPromo.expiresAt).toLocaleDateString()}</em></p>` : ''}
              </div>
            `;
            this.emailService.sendEmail(user.email, 'Your Exclusive Promo Code 🎁', htmlContent).catch(console.error);
          }
        });
      }).catch(console.error);
    }

    // 2. Notify the Referrer (Errand Ninja, Customer, Vendor, Ambassador) that they have a new referral promo code!
    if (isReferralPromo) {
      this.notifyReferrerOfPromoCode(savedPromo).catch(err => {
        this.logger.warn(`Failed to notify referrer for promo ${savedPromo.code}: ${err.message}`);
      });
    }

    return savedPromo;
  }

  private async notifyReferrerOfPromoCode(promo: PromoCode) {
    let email = '';
    let name = '';
    let roleLabel = 'Referral Partner';

    if (promo.referrerType === 'facilitator' && promo.referrerFacilitator) {
      const fac = await this.facilitatorModel.findById(promo.referrerFacilitator);
      if (fac) {
        email = fac.email;
        name = fac.name;
        roleLabel = 'Campus Ambassador';
      }
    } else if (promo.referrerUser) {
      const user = await this.userModel.findById(promo.referrerUser);
      if (user) {
        email = user.email;
        name = `${user.firstName} ${user.lastName}`;
        roleLabel = user.role === UserRole.ERRANDER ? 'Errand Ninja' : user.role === UserRole.VENDOR ? 'Vendor Partner' : 'Customer';
      }
    }

    if (!email) return;

    const discountLabel = promo.discountType === 'percentage' ? `${promo.value}% OFF` : `₦${promo.value} OFF`;
    const rewardLabel = promo.rewardType === 'wallet_credit' ? `₦${promo.rewardPerUse} wallet credit` : `${promo.rewardPerUse} points`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border-radius: 16px; border: 1px solid #f0f0f0;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #111827; font-size: 22px; font-weight: 800; margin: 0 0 8px 0;">Your Official Erranders Promo Code is Live! 🚀</h1>
          <p style="color: #6b7280; font-size: 14px; margin: 0;">Special affiliate perk for our valued ${roleLabel}</p>
        </div>

        <p style="color: #374151; font-size: 15px; line-height: 1.6;">Hello <strong>${name}</strong>,</p>
        <p style="color: #374151; font-size: 14px; line-height: 1.6;">
          An exclusive referral promo code has been created for you. Share this code with friends, students, and your community. Anyone who applies your code gets an instant discount, and you earn rewards on every completed order!
        </p>

        <div style="background: linear-gradient(135deg, #111827 0%, #1f2937 100%); color: #ffffff; padding: 24px; border-radius: 14px; text-align: center; margin: 24px 0; border: 1px solid #374151;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #9ca3af; margin-bottom: 8px;">Your Promo Code</div>
          <div style="font-size: 32px; font-weight: 900; letter-spacing: 4px; color: #FF5C1A; font-family: monospace;">${promo.code}</div>
          <div style="margin-top: 12px; font-size: 13px; color: #e5e7eb;">
            Gives: <strong>${discountLabel}</strong> • You Earn: <strong>${rewardLabel}</strong> per redemption
          </div>
        </div>

        <p style="color: #6b7280; font-size: 13px; line-height: 1.5; text-align: center;">
          Track your referrals, orders, and rewards real-time on your Erranders app dashboard.
        </p>
      </div>
    `;

    await this.emailService.sendEmail(email, `Your Custom Erranders Promo Code: ${promo.code} 🎟️`, html);
  }

  async update(id: string, data: any): Promise<PromoCode> {
    const promo = await this.promoCodeModel.findById(id);
    if (!promo) {
      throw new NotFoundException('Promo code not found');
    }
    if (data.code) {
      const cleanCode = data.code.trim().toUpperCase();
      const existing = await this.promoCodeModel.findOne({ code: cleanCode, _id: { $ne: id } });
      if (existing) {
        throw new BadRequestException('Another promo code with this code already exists');
      }
      data.code = cleanCode;
    }

    if (data.referrerFacilitator) {
      data.referrerType = 'facilitator';
      data.isReferralPromo = true;
    } else if (data.referrerUser) {
      const user = await this.userModel.findById(data.referrerUser);
      if (user) {
        data.referrerType = user.role;
        data.isReferralPromo = true;
      }
    }
    
    Object.assign(promo, data);
    return promo.save();
  }

  async findAll(): Promise<PromoCode[]> {
    return this.promoCodeModel
      .find()
      .populate('referrerUser', 'firstName lastName email role phone referralCode avatar')
      .populate('referrerFacilitator', 'name email referralCode tier totalReferrals')
      .populate('applicableVendors', 'storeName businessName name email')
      .populate('applicableUsers', 'firstName lastName email phone')
      .sort({ createdAt: -1 });
  }

  async findByCode(code: string): Promise<PromoCode> {
    const promo = await this.promoCodeModel.findOne({ code: code.trim().toUpperCase() });
    if (!promo) {
      throw new NotFoundException('Promo code not found');
    }
    return promo;
  }

  async getReferralPromos(query?: { referrerType?: string; search?: string }): Promise<PromoCode[]> {
    const filter: any = {
      $or: [
        { isReferralPromo: true },
        { referrerType: { $in: ['errander', 'student', 'vendor', 'facilitator'] } },
        { referrerUser: { $exists: true, $ne: null } },
        { referrerFacilitator: { $exists: true, $ne: null } },
      ],
    };

    if (query?.referrerType && query.referrerType !== 'all') {
      filter.referrerType = query.referrerType;
    }

    if (query?.search) {
      filter.code = { $regex: query.search.trim(), $options: 'i' };
    }

    return this.promoCodeModel
      .find(filter)
      .populate('referrerUser', 'firstName lastName email role phone referralCode avatar points walletBalance')
      .populate('referrerFacilitator', 'name email referralCode tier totalReferrals pointsEarned')
      .sort({ usageCount: -1, createdAt: -1 });
  }

  async getStatsOverview() {
    const [
      totalPromos,
      referralPromos,
      redemptionsCount,
      revenueAggregation,
      redemptionsByType,
    ] = await Promise.all([
      this.promoCodeModel.countDocuments(),
      this.promoCodeModel.countDocuments({
        $or: [{ isReferralPromo: true }, { referrerType: { $in: ['errander', 'student', 'vendor', 'facilitator'] } }],
      }),
      this.promoRedemptionModel.countDocuments(),
      this.promoRedemptionModel.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$orderTotal' },
            totalDiscounts: { $sum: '$discountAmount' },
            totalRewards: { $sum: '$rewardAwarded' },
          },
        },
      ]),
      this.promoRedemptionModel.aggregate([
        { $group: { _id: '$referrerType', count: { $sum: 1 }, revenue: { $sum: '$orderTotal' } } },
      ]),
    ]);

    const personaBreakdown: Record<string, { count: number; revenue: number }> = {
      errander: { count: 0, revenue: 0 },
      student: { count: 0, revenue: 0 },
      vendor: { count: 0, revenue: 0 },
      facilitator: { count: 0, revenue: 0 },
    };

    redemptionsByType.forEach((item: any) => {
      if (item._id && personaBreakdown[item._id]) {
        personaBreakdown[item._id] = { count: item.count, revenue: item.revenue };
      }
    });

    return {
      totalPromos,
      referralPromos,
      totalRedemptions: redemptionsCount,
      totalRevenue: revenueAggregation[0]?.totalRevenue || 0,
      totalDiscounts: revenueAggregation[0]?.totalDiscounts || 0,
      totalRewards: revenueAggregation[0]?.totalRewards || 0,
      personaBreakdown,
    };
  }

  async getRedemptions(promoId?: string, query?: { page?: number; limit?: number }) {
    const page = query?.page || 1;
    const limit = query?.limit || 50;
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (promoId) {
      filter.promoId = new Types.ObjectId(promoId);
    }

    const [redemptions, total] = await Promise.all([
      this.promoRedemptionModel
        .find(filter)
        .populate('customer', 'firstName lastName email phone avatar role')
        .populate('referrerUser', 'firstName lastName email role')
        .populate('referrerFacilitator', 'name email referralCode')
        .populate('orderId', 'orderType total status deliveryOption createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.promoRedemptionModel.countDocuments(filter),
    ]);

    return { redemptions, total, page, pages: Math.ceil(total / limit) };
  }

  async validateCode(
    code: string, 
    subtotal: number, 
    userId?: string, 
    vendorId?: string, 
    userOrdersCount?: number,
    orderContext?: { 
      isGroupOrder?: boolean; 
      locationType?: string; 
      isCustomErrand?: boolean;
      isScheduled?: boolean;
      isPreOrder?: boolean;
      orderType?: string;
    }
  ): Promise<PromoCode> {
    if (!code || !code.trim()) {
      throw new BadRequestException('Promo code is required');
    }
    const cleanCode = code.trim().toUpperCase();
    const promo = await this.promoCodeModel.findOne({ code: cleanCode });
    if (!promo) {
      throw new BadRequestException('Invalid promo code');
    }
    if (!promo.isActive) {
      throw new BadRequestException('This promo code is currently disabled or inactive');
    }
    if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
      throw new BadRequestException('This promo code has expired');
    }
    if (promo.minOrderAmount && subtotal < promo.minOrderAmount) {
      throw new BadRequestException(`Order amount must be at least ₦${promo.minOrderAmount.toLocaleString()} to use this code`);
    }
    if (promo.maxUsageCount && promo.maxUsageCount > 0 && promo.usageCount >= promo.maxUsageCount) {
      throw new BadRequestException('This promo code has reached its maximum global usage limit');
    }
    
    // Per-User redemption limit check
    if (promo.maxUsagePerUser && promo.maxUsagePerUser > 0 && userId) {
      const userRedemptions = await this.promoRedemptionModel.countDocuments({
        promoId: promo._id,
        customer: new Types.ObjectId(userId),
      });
      if (userRedemptions >= promo.maxUsagePerUser) {
        throw new BadRequestException(`You have reached the maximum allowed redemption limit (${promo.maxUsagePerUser}) for this promo code`);
      }
    }

    // Specific vendor restriction check
    if (promo.applicableVendors && promo.applicableVendors.length > 0) {
      if (!vendorId) {
        throw new BadRequestException('This promo code is restricted to specific vendors only');
      }
      const vendorStringIds = promo.applicableVendors.map(v => v.toString());
      if (!vendorStringIds.includes(vendorId.toString())) {
        throw new BadRequestException('This promo code is not valid for this vendor store');
      }
    }

    // Specific user account restriction check
    if (promo.applicableUsers && promo.applicableUsers.length > 0) {
      if (!userId) {
        throw new BadRequestException('This promo code is restricted to specific accounts only');
      }
      const userStringIds = promo.applicableUsers.map(u => u.toString());
      if (!userStringIds.includes(userId.toString())) {
        throw new BadRequestException('This promo code is exclusive and not applicable to your account');
      }
    }

    // New customers only check
    if (promo.onlyForNewUsers) {
      let count = userOrdersCount;
      if (count === undefined && userId) {
        count = await this.orderModel.countDocuments({
          customer: new Types.ObjectId(userId),
          status: { $nin: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] }
        });
      }
      if (count !== undefined && count > 0) {
        throw new BadRequestException('This promo code is only valid for new customers on their first order');
      }
    }

    // Order Fulfillment & Order Type Restrictions check
    if (promo.applicableOrderTypes && promo.applicableOrderTypes.length > 0 && orderContext) {
      const { isGroupOrder, locationType, isCustomErrand, isScheduled, isPreOrder, orderType } = orderContext;
      const currentTypes: string[] = [];

      if (isGroupOrder) currentTypes.push('group_order');
      if (isCustomErrand || orderType === 'custom_errand') currentTypes.push('custom_errand');
      if (isScheduled || isPreOrder) currentTypes.push('scheduled');
      if (!isScheduled && !isPreOrder && !isCustomErrand && orderType !== 'custom_errand') currentTypes.push('on_demand');
      if (orderType === 'marketplace' || (!isCustomErrand && orderType !== 'custom_errand')) currentTypes.push('marketplace');
      if (locationType === 'outside_campus' || locationType === 'campus_environs') currentTypes.push('outside_campus');
      if (locationType === 'inside_campus' || !locationType) currentTypes.push('inside_campus');

      const isAllowed = promo.applicableOrderTypes.some(allowedType => currentTypes.includes(allowedType));
      if (!isAllowed) {
        throw new BadRequestException('This promo code is not applicable for this fulfillment or order type');
      }
    }

    return promo;
  }

  async previewCode(
    code: string, 
    subtotal: number, 
    userId?: string, 
    vendorId?: string, 
    userOrdersCount?: number,
    orderContext?: { 
      isGroupOrder?: boolean; 
      locationType?: string; 
      isCustomErrand?: boolean;
      isScheduled?: boolean;
      isPreOrder?: boolean;
      orderType?: string;
    }
  ): Promise<any> {
    if (!code || !code.trim()) {
      return { found: false, promo: null, eligibility: null };
    }
    const cleanCode = code.trim().toUpperCase();
    const promo = await this.promoCodeModel.findOne({ code: cleanCode });
    
    if (!promo) {
      return { found: false, promo: null, eligibility: null };
    }

    const eligibility = {
      isActive: promo.isActive,
      isExpired: promo.expiresAt ? new Date(promo.expiresAt) < new Date() : false,
      minAmountMet: !promo.minOrderAmount || subtotal >= promo.minOrderAmount,
      usageLimitReached: promo.maxUsageCount ? promo.usageCount >= promo.maxUsageCount : false,
      userRedemptionsMet: true,
      vendorAllowed: true,
      userAllowed: true,
      newUsersOnlyMet: true,
      orderTypeAllowed: true,
      isEligible: false
    };

    if (promo.maxUsagePerUser && promo.maxUsagePerUser > 0 && userId) {
      const userRedemptions = await this.promoRedemptionModel.countDocuments({
        promoId: promo._id,
        customer: new Types.ObjectId(userId),
      });
      eligibility.userRedemptionsMet = userRedemptions < promo.maxUsagePerUser;
    }

    if (promo.applicableVendors && promo.applicableVendors.length > 0) {
      if (vendorId) {
        const vendorStringIds = promo.applicableVendors.map(v => v.toString());
        eligibility.vendorAllowed = vendorStringIds.includes(vendorId.toString());
      } else {
        eligibility.vendorAllowed = false;
      }
    }

    if (promo.applicableUsers && promo.applicableUsers.length > 0) {
      if (userId) {
        const userStringIds = promo.applicableUsers.map(u => u.toString());
        eligibility.userAllowed = userStringIds.includes(userId.toString());
      } else {
        eligibility.userAllowed = false;
      }
    }

    if (promo.onlyForNewUsers) {
      let count = userOrdersCount;
      if (count === undefined && userId) {
        count = await this.orderModel.countDocuments({
          customer: new Types.ObjectId(userId),
          status: { $nin: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] }
        });
      }
      if (count !== undefined) {
        eligibility.newUsersOnlyMet = count === 0;
      }
    }

    if (promo.applicableOrderTypes && promo.applicableOrderTypes.length > 0 && orderContext) {
      const { isGroupOrder, locationType, isCustomErrand, isScheduled, isPreOrder, orderType } = orderContext;
      const currentTypes: string[] = [];

      if (isGroupOrder) currentTypes.push('group_order');
      if (isCustomErrand || orderType === 'custom_errand') currentTypes.push('custom_errand');
      if (isScheduled || isPreOrder) currentTypes.push('scheduled');
      if (!isScheduled && !isPreOrder && !isCustomErrand && orderType !== 'custom_errand') currentTypes.push('on_demand');
      if (orderType === 'marketplace' || (!isCustomErrand && orderType !== 'custom_errand')) currentTypes.push('marketplace');
      if (locationType === 'outside_campus' || locationType === 'campus_environs') currentTypes.push('outside_campus');
      if (locationType === 'inside_campus' || !locationType) currentTypes.push('inside_campus');

      eligibility.orderTypeAllowed = promo.applicableOrderTypes.some(allowedType => currentTypes.includes(allowedType));
    }

    eligibility.isEligible = 
      eligibility.isActive &&
      !eligibility.isExpired &&
      eligibility.minAmountMet &&
      !eligibility.usageLimitReached &&
      eligibility.userRedemptionsMet &&
      eligibility.vendorAllowed &&
      eligibility.userAllowed &&
      eligibility.newUsersOnlyMet &&
      eligibility.orderTypeAllowed;

    let calculatedDiscount = 0;
    if (eligibility.isEligible) {
      if (promo.discountType === 'percentage') {
        calculatedDiscount = Math.round(subtotal * (promo.value / 100));
        if (promo.maxDiscountAmount && calculatedDiscount > promo.maxDiscountAmount) {
          calculatedDiscount = promo.maxDiscountAmount;
        }
      } else {
        calculatedDiscount = promo.value;
      }
      if (calculatedDiscount > subtotal) {
        calculatedDiscount = subtotal;
      }
    }

    return { 
      found: true, 
      promo, 
      eligibility, 
      estimatedDiscount: calculatedDiscount 
    };
  }

  async incrementUsage(code: string) {
    await this.promoCodeModel.updateOne(
      { code: code.trim().toUpperCase() },
      { $inc: { usageCount: 1 } }
    );
  }

  /**
   * Record a full redemption event when an order is placed with a promo code.
   * Updates stats, awards rewards to referrers (Ninja/Customer/Vendor/Ambassador),
   * and tracks referral linkage.
   */
  async recordRedemption(data: {
    code: string;
    orderId: string;
    customerId: string;
    orderTotal: number;
    discountAmount: number;
  }) {
    if (!data.code) return;
    const cleanCode = data.code.trim().toUpperCase();

    const promo = await this.promoCodeModel.findOne({ code: cleanCode });
    if (!promo) {
      this.logger.warn(`Promo code ${cleanCode} not found for redemption recording`);
      return;
    }

    const orderTotal = Number(data.orderTotal) || 0;
    const discountAmount = Number(data.discountAmount) || 0;
    let rewardAwarded = 0;

    // Determine reward if referrer is attached
    const isAffiliate = promo.isReferralPromo || (promo.referrerType && promo.referrerType !== 'none');
    if (isAffiliate) {
      rewardAwarded = promo.rewardPerUse !== undefined ? promo.rewardPerUse : 50;

      // 1. Facilitator Ambassador
      if (promo.referrerType === 'facilitator' && promo.referrerFacilitator) {
        const fac = await this.facilitatorModel.findById(promo.referrerFacilitator);
        if (fac) {
          if (promo.rewardType === 'wallet_credit' && rewardAwarded > 0 && fac.linkedUserId) {
            try {
              await this.walletsService.creditWallet(
                fac.linkedUserId.toString(),
                rewardAwarded,
                `Ambassador referral commission for promo ${cleanCode}`,
                data.orderId,
                `PROMO-AMB-${cleanCode}-${data.orderId}`
              );
            } catch (wErr) {
              this.logger.error(`Failed to credit wallet for facilitator user ${fac.linkedUserId}: ${wErr.message}`);
              fac.pointsEarned = (fac.pointsEarned || 0) + rewardAwarded;
            }
          } else {
            fac.pointsEarned = (fac.pointsEarned || 0) + rewardAwarded;
          }
          fac.totalReferrals = (fac.totalReferrals || 0) + 1;
          await fac.save();
          this.logger.log(`Awarded ${rewardAwarded} ${promo.rewardType || 'points'} to Ambassador ${fac.name} for promo code redemption`);
        }
      }
      // 2. Errand Ninja, Customer, or Vendor
      else if (promo.referrerUser) {
        const user = await this.userModel.findById(promo.referrerUser);
        if (user) {
          if (promo.rewardType === 'wallet_credit' && rewardAwarded > 0) {
            try {
              await this.walletsService.creditWallet(
                user._id.toString(),
                rewardAwarded,
                `Referral promo commission for code ${cleanCode}`,
                data.orderId,
                `PROMO-${cleanCode}-${data.orderId}`
              );
            } catch (wErr) {
              this.logger.error(`Failed to credit wallet for referrer ${user._id}: ${wErr.message}`);
              user.points = (user.points || 0) + rewardAwarded;
              await user.save();
            }
          } else {
            user.points = (user.points || 0) + rewardAwarded;
            user.referralCount = (user.referralCount || 0) + 1;
            await user.save();
          }
          this.logger.log(`Awarded ${rewardAwarded} ${promo.rewardType} to ${user.role} ${user.email} for promo code redemption`);
        }
      }
    }

    // Atomically increment promo stats
    await this.promoCodeModel.updateOne(
      { _id: promo._id },
      {
        $inc: {
          usageCount: 1,
          totalRevenueGenerated: orderTotal,
          totalDiscountGiven: discountAmount,
          totalEarnings: rewardAwarded,
        }
      }
    );

    // Create redemption record
    await this.promoRedemptionModel.create({
      promoCode: cleanCode,
      promoId: promo._id,
      orderId: new Types.ObjectId(data.orderId),
      customer: new Types.ObjectId(data.customerId),
      orderTotal,
      discountAmount,
      referrerUser: promo.referrerUser,
      referrerFacilitator: promo.referrerFacilitator,
      referrerType: promo.referrerType || 'none',
      rewardAwarded,
      rewardType: promo.rewardType || 'points',
    });

    // Check if this customer needs a referral attribution record
    if (isAffiliate && data.customerId) {
      try {
        const existingRef = await this.referralModel.findOne({ referred: new Types.ObjectId(data.customerId) });
        if (!existingRef) {
          const customerUser = await this.userModel.findById(data.customerId);
          await this.referralModel.create({
            referrer: promo.referrerUser || undefined,
            facilitatorReferrer: promo.referrerFacilitator || undefined,
            referred: new Types.ObjectId(data.customerId),
            referralCode: cleanCode,
            referrerType: promo.referrerType,
            referredType: customerUser?.role || ReferredType.STUDENT,
            status: ReferralStatus.COMPLETED,
            referrerPointsAwarded: rewardAwarded,
            referredPointsAwarded: 100,
            firstOrderCompleted: true,
            firstOrderDate: new Date(),
            notes: `Converted via referral promo code ${cleanCode}`,
          });
        } else if (!existingRef.firstOrderCompleted) {
          existingRef.firstOrderCompleted = true;
          existingRef.firstOrderDate = new Date();
          existingRef.status = ReferralStatus.COMPLETED;
          await existingRef.save();
        }
      } catch (refErr) {
        this.logger.warn(`Referral attribution update error: ${refErr.message}`);
      }
    }
  }

  async toggleActive(id: string): Promise<PromoCode> {
    const promo = await this.promoCodeModel.findById(id);
    if (!promo) throw new NotFoundException('Promo code not found');
    promo.isActive = !promo.isActive;
    return promo.save();
  }
}
