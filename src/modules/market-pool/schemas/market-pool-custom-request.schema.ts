import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Document, Types } from 'mongoose';

export enum CustomRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

@Schema({ timestamps: true })
export class MarketPoolCustomRequest extends Document {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'MarketPoolCampaign', required: true })
  campaignId: Types.ObjectId;

  @Prop({ required: true })
  itemName: string;

  @Prop()
  description: string;

  @Prop({ required: true })
  desiredQuantity: string; // e.g., "1 Bag", "1 Derica"

  @Prop({ type: String, enum: CustomRequestStatus, default: CustomRequestStatus.PENDING })
  status: CustomRequestStatus;
}

export const MarketPoolCustomRequestSchema = SchemaFactory.createForClass(MarketPoolCustomRequest);
