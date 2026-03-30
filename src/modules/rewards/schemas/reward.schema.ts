import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum RewardType {
  DISCOUNT = 'discount',
  FREE_DELIVERY = 'free_delivery',
}

@Schema({ timestamps: true })
export class Reward extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ type: String, enum: RewardType, required: true })
  type: RewardType;

  @Prop({ default: 0 })
  value: number; // For discount, e.g., 500 for N500 off

  @Prop({ required: true, unique: true })
  code: string;

  @Prop({ default: false })
  isUsed: boolean;

  @Prop()
  expiryDate: Date;

  @Prop({ index: true })
  deviceId: string;
}

export const RewardSchema = SchemaFactory.createForClass(Reward);
RewardSchema.index({ user: 1, createdAt: -1 });
RewardSchema.index({ deviceId: 1, createdAt: -1 });
RewardSchema.index({ code: 1 });
