import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class PromoRedemption extends Document {
  @Prop({ required: true, uppercase: true, index: true })
  promoCode: string;

  @Prop({ type: Types.ObjectId, ref: 'PromoCode', required: true, index: true })
  promoId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Order', required: true, index: true })
  orderId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  customer: Types.ObjectId;

  @Prop({ default: 0 })
  orderTotal: number;

  @Prop({ default: 0 })
  discountAmount: number;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  referrerUser?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Facilitator', index: true })
  referrerFacilitator?: Types.ObjectId;

  @Prop({ type: String, default: 'none', index: true })
  referrerType: string;

  @Prop({ default: 0 })
  rewardAwarded: number;

  @Prop({ type: String, default: 'points' })
  rewardType: string;
}

export const PromoRedemptionSchema = SchemaFactory.createForClass(PromoRedemption);
PromoRedemptionSchema.index({ promoId: 1, createdAt: -1 });
PromoRedemptionSchema.index({ referrerUser: 1, createdAt: -1 });
PromoRedemptionSchema.index({ referrerFacilitator: 1, createdAt: -1 });
PromoRedemptionSchema.index({ customer: 1, createdAt: -1 });
