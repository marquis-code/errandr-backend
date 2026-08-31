import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum MarketPoolCampaignStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  AGGREGATING = 'aggregating',
  DELIVERED = 'delivered',
}

@Schema({ timestamps: true })
export class MarketPoolCampaign extends Document {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  startDate: Date;

  @Prop({ required: true })
  endDate: Date;

  @Prop({ type: String, enum: MarketPoolCampaignStatus, default: MarketPoolCampaignStatus.OPEN })
  status: MarketPoolCampaignStatus;
}

export const MarketPoolCampaignSchema = SchemaFactory.createForClass(MarketPoolCampaign);
