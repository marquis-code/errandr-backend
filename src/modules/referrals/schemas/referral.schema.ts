import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum ReferralStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  REWARDED = 'rewarded',
}

export enum ReferrerType {
  STUDENT = 'student',
  VENDOR = 'vendor',
  ERRANDER = 'errander',
  FACILITATOR = 'facilitator',
}

export enum ReferredType {
  STUDENT = 'student',
  VENDOR = 'vendor',
  ERRANDER = 'errander',
}

@Schema({ timestamps: true })
export class Referral extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  referrer: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Facilitator', index: true })
  facilitatorReferrer: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  referred: Types.ObjectId;

  @Prop({ required: true, index: true })
  referralCode: string;

  @Prop({ type: String, enum: ReferrerType, required: true })
  referrerType: ReferrerType;

  @Prop({ type: String, enum: ReferredType, required: true })
  referredType: ReferredType;

  @Prop({ type: String, enum: ReferralStatus, default: ReferralStatus.PENDING })
  status: ReferralStatus;

  @Prop({ default: 0 })
  referrerPointsAwarded: number;

  @Prop({ default: 0 })
  referredPointsAwarded: number;

  @Prop()
  tier: string;

  @Prop({ default: false })
  firstOrderCompleted: boolean;

  @Prop()
  firstOrderDate: Date;

  @Prop()
  notes: string;
}

export const ReferralSchema = SchemaFactory.createForClass(Referral);
ReferralSchema.index({ referrer: 1, createdAt: -1 });
ReferralSchema.index({ facilitatorReferrer: 1, createdAt: -1 });
ReferralSchema.index({ referralCode: 1 });
ReferralSchema.index({ status: 1 });
ReferralSchema.index({ createdAt: -1 });
