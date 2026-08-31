import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class MarketPoolItem extends Document {
  @Prop({ type: Types.ObjectId, ref: 'MarketPoolCampaign', required: true })
  campaignId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop()
  imageUrl: string;

  @Prop({ required: true })
  studentQuantity: string; // e.g., "1 Derica"

  @Prop({ required: true })
  wholesaleEstimatedCost: number;

  @Prop({ required: true })
  appPrice: number; // Includes 10-15% buffer
}

export const MarketPoolItemSchema = SchemaFactory.createForClass(MarketPoolItem);
