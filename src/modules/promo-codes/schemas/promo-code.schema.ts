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
}

export const PromoCodeSchema = SchemaFactory.createForClass(PromoCode);
