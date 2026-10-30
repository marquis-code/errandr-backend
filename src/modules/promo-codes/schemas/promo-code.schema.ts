import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum DiscountType {
  PERCENTAGE = 'percentage',
  FLAT = 'flat',
}

@Schema({ timestamps: true })
export class PromoCode extends Document {
  @Prop({ required: true, unique: true, uppercase: true })
  code: string;

  @Prop({ required: true, enum: DiscountType })
  discountType: DiscountType;

  @Prop({ required: true })
  value: number; // e.g., 10 for 10% off, or 500 for N500 off

  @Prop({ default: 0 })
  minOrderAmount: number;

  @Prop({ default: 0 })
  maxDiscountAmount: number; // For percentage discounts (e.g., max 1000 NGN)

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  expiresAt: Date;

  @Prop({ default: 0 })
  usageCount: number;

  @Prop()
  maxUsageCount: number; // Optional limit on how many times the code can be used globally

  @Prop({ default: 0 })
  maxUsagePerUser: number; // Optional limit on how many times an individual user can redeem this code (0 = unlimited)

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Vendor' }] })
  applicableVendors: Types.ObjectId[]; // If empty, applies to all vendors

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }] })
  applicableUsers: Types.ObjectId[]; // If empty, applies to all users

  @Prop({ default: false })
  onlyForNewUsers: boolean; // If true, only users with 0 completed orders can use this

  @Prop({ type: [String] })
  applicableOrderTypes: string[]; // e.g., 'inside_campus', 'outside_campus', 'custom_errand', 'group_order'

  @Prop({ default: false })
  appliesToDeliveryFeeOnly: boolean; // If true, discount only affects delivery fee, not item subtotal

  // ── Referrer / Affiliate Assignment ──
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  referrerUser?: Types.ObjectId; // For Errand Ninjas (errander), Customers (student), or Vendors (vendor)

  @Prop({ type: Types.ObjectId, ref: 'Facilitator', index: true })
  referrerFacilitator?: Types.ObjectId; // For Campus Ambassadors (facilitator)

  @Prop({ type: String, enum: ['errander', 'student', 'vendor', 'facilitator', 'none'], default: 'none', index: true })
  referrerType: string;

  @Prop({ default: false, index: true })
  isReferralPromo: boolean;

  @Prop({ default: 50 })
  rewardPerUse: number; // Points or cash credited to referrer per redemption

  @Prop({ type: String, enum: ['points', 'wallet_credit'], default: 'points' })
  rewardType: string;

  @Prop({ default: 0 })
  totalRevenueGenerated: number; // Sum of order totals where this promo code was applied

  @Prop({ default: 0 })
  totalDiscountGiven: number; // Sum of discounts given out

  @Prop({ default: 0 })
  totalEarnings: number; // Total points or cash earned by referrer from this promo code
}

export const PromoCodeSchema = SchemaFactory.createForClass(PromoCode);
PromoCodeSchema.index({ referrerUser: 1 });
PromoCodeSchema.index({ referrerFacilitator: 1 });
PromoCodeSchema.index({ referrerType: 1 });
PromoCodeSchema.index({ isReferralPromo: 1 });

