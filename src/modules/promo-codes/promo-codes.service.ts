import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PromoCode } from './schemas/promo-code.schema';
import { User } from '../users/schemas/user.schema';
import { EmailService } from '../email/email.service';

@Injectable()
export class PromoCodesService {
  constructor(
    @InjectModel(PromoCode.name) private readonly promoCodeModel: Model<PromoCode>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly emailService: EmailService,
  ) {}

  async create(data: any): Promise<PromoCode> {
    const existing = await this.promoCodeModel.findOne({ code: data.code.toUpperCase() });
    if (existing) {
      throw new BadRequestException('Promo code already exists');
    }
    const promo = new this.promoCodeModel({
      ...data,
      code: data.code.toUpperCase(),
    });
    const savedPromo = await promo.save();

    if (data.applicableUsers && data.applicableUsers.length > 0) {
      // Dispatch emails
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

    return savedPromo;
  }

  async update(id: string, data: any): Promise<PromoCode> {
    const promo = await this.promoCodeModel.findById(id);
    if (!promo) {
      throw new NotFoundException('Promo code not found');
    }
    if (data.code) {
      const existing = await this.promoCodeModel.findOne({ code: data.code.toUpperCase(), _id: { $ne: id } });
      if (existing) {
        throw new BadRequestException('Another promo code with this code already exists');
      }
      data.code = data.code.toUpperCase();
    }
    
    Object.assign(promo, data);
    return promo.save();
  }

  async findAll(): Promise<PromoCode[]> {
    return this.promoCodeModel.find().sort({ createdAt: -1 });
  }

  async findByCode(code: string): Promise<PromoCode> {
    const promo = await this.promoCodeModel.findOne({ code: code.toUpperCase() });
    if (!promo) {
      throw new NotFoundException('Promo code not found');
    }
    return promo;
  }

  async validateCode(
    code: string, 
    subtotal: number, 
    userId?: string, 
    vendorId?: string, 
    userOrdersCount?: number,
    orderContext?: { isGroupOrder?: boolean; locationType?: string; isCustomErrand?: boolean }
  ): Promise<PromoCode> {
    const promo = await this.promoCodeModel.findOne({ code: code.toUpperCase() });
    if (!promo) {
      throw new BadRequestException('Invalid promo code');
    }
    if (!promo.isActive) {
      throw new BadRequestException('Promo code is not active');
    }
    if (promo.expiresAt && promo.expiresAt < new Date()) {
      throw new BadRequestException('Promo code has expired');
    }
    if (promo.minOrderAmount && subtotal < promo.minOrderAmount) {
      throw new BadRequestException(`Order amount must be at least ₦${promo.minOrderAmount} to use this code`);
    }
    if (promo.maxUsageCount && promo.usageCount >= promo.maxUsageCount) {
      throw new BadRequestException('Promo code usage limit reached');
    }
    
    // Robust restrictions
    if (promo.applicableVendors && promo.applicableVendors.length > 0 && vendorId) {
      const vendorStringIds = promo.applicableVendors.map(v => v.toString());
      if (!vendorStringIds.includes(vendorId.toString())) {
        throw new BadRequestException('Promo code is not applicable to this vendor');
      }
    }

    if (promo.applicableUsers && promo.applicableUsers.length > 0 && userId) {
      const userStringIds = promo.applicableUsers.map(u => u.toString());
      if (!userStringIds.includes(userId.toString())) {
        throw new BadRequestException('Promo code is not applicable to your account');
      }
    }

    if (promo.onlyForNewUsers && userOrdersCount !== undefined && userOrdersCount > 0) {
      throw new BadRequestException('Promo code is only valid for new users on their first order');
    }

    // Order Type Restrictions
    if (promo.applicableOrderTypes && promo.applicableOrderTypes.length > 0 && orderContext) {
      const { isGroupOrder, locationType, isCustomErrand } = orderContext;
      const currentTypes: string[] = [];
      if (isGroupOrder) currentTypes.push('group_order');
      if (isCustomErrand) currentTypes.push('custom_errand');
      if (locationType === 'outside_campus') currentTypes.push('outside_campus');
      if (locationType === 'inside_campus') currentTypes.push('inside_campus');

      // Check if there is an intersection between allowed types and current types
      const isAllowed = promo.applicableOrderTypes.some(allowedType => currentTypes.includes(allowedType));
      
      if (!isAllowed) {
        throw new BadRequestException('Promo code is not applicable for this type of order');
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
    orderContext?: { isGroupOrder?: boolean; locationType?: string; isCustomErrand?: boolean }
  ): Promise<any> {
    const promo = await this.promoCodeModel.findOne({ code: code.toUpperCase() });
    
    if (!promo) {
      return { found: false, promo: null, eligibility: null };
    }

    const eligibility = {
      isActive: promo.isActive,
      isExpired: promo.expiresAt ? promo.expiresAt < new Date() : false,
      minAmountMet: !promo.minOrderAmount || subtotal >= promo.minOrderAmount,
      usageLimitReached: promo.maxUsageCount ? promo.usageCount >= promo.maxUsageCount : false,
      vendorAllowed: true,
      userAllowed: true,
      newUsersOnlyMet: true,
      orderTypeAllowed: true,
      isEligible: false
    };

    if (promo.applicableVendors && promo.applicableVendors.length > 0 && vendorId) {
      const vendorStringIds = promo.applicableVendors.map(v => v.toString());
      eligibility.vendorAllowed = vendorStringIds.includes(vendorId.toString());
    }

    if (promo.applicableUsers && promo.applicableUsers.length > 0 && userId) {
      const userStringIds = promo.applicableUsers.map(u => u.toString());
      eligibility.userAllowed = userStringIds.includes(userId.toString());
    }

    if (promo.onlyForNewUsers && userOrdersCount !== undefined) {
      eligibility.newUsersOnlyMet = userOrdersCount === 0;
    }

    if (promo.applicableOrderTypes && promo.applicableOrderTypes.length > 0 && orderContext) {
      const { isGroupOrder, locationType, isCustomErrand } = orderContext;
      const currentTypes: string[] = [];
      if (isGroupOrder) currentTypes.push('group_order');
      if (isCustomErrand) currentTypes.push('custom_errand');
      if (locationType === 'outside_campus') currentTypes.push('outside_campus');
      if (locationType === 'inside_campus') currentTypes.push('inside_campus');

      eligibility.orderTypeAllowed = promo.applicableOrderTypes.some(allowedType => currentTypes.includes(allowedType));
    }

    eligibility.isEligible = 
      eligibility.isActive &&
      !eligibility.isExpired &&
      eligibility.minAmountMet &&
      !eligibility.usageLimitReached &&
      eligibility.vendorAllowed &&
      eligibility.userAllowed &&
      eligibility.newUsersOnlyMet &&
      eligibility.orderTypeAllowed;

    return { found: true, promo, eligibility };
  }

  async incrementUsage(code: string) {
    await this.promoCodeModel.updateOne(
      { code: code.toUpperCase() },
      { $inc: { usageCount: 1 } }
    );
  }

  async toggleActive(id: string): Promise<PromoCode> {
    const promo = await this.promoCodeModel.findById(id);
    if (!promo) throw new NotFoundException('Promo code not found');
    promo.isActive = !promo.isActive;
    return promo.save();
  }
}
