import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class MarketPoolItem extends Document {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'MarketPoolCampaign', required: true })
  campaignId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop({ default: 'Uncategorized' })
  category: string;

  @Prop()
  imageUrl: string;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ required: true })
  studentQuantity: string; // e.g., "1 Derica"

  @Prop({ required: true })
  wholesaleEstimatedCost: number;

  @Prop({ required: true })
  appPrice: number; // Includes 10-15% buffer

  @Prop({ default: 0 })
  targetQuantity: number;

  @Prop({ default: 0 })
  currentQuantity: number;

  @Prop()
  sourceLocation: string;

  @Prop()
  weightEstimate: string;

  @Prop({ type: [{ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, rating: Number, comment: String }] })
  reviews: any[];
}

export const MarketPoolItemSchema = SchemaFactory.createForClass(MarketPoolItem);
