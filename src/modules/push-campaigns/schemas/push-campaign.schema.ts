import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PushCampaignDocument = PushCampaign & Document;

@Schema({ timestamps: true })
export class PushCampaign {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  body: string;

  @Prop({ required: false })
  imageUrl?: string;

  @Prop({ required: true, enum: ['student', 'vendor', 'all'], default: 'all' })
  targetAudience: string;

  @Prop({ required: true, default: 6 })
  intervalValue: number;

  @Prop({ required: true, enum: ['seconds', 'minutes', 'hours'], default: 'hours' })
  intervalUnit: string;

  @Prop({ required: true, default: true })
  isActive: boolean;

  @Prop({ required: true, default: true })
  sendPush: boolean;

  @Prop({ required: true, default: false })
  sendEmail: boolean;

  @Prop({ required: false })
  lastSentAt?: Date;
}

export const PushCampaignSchema = SchemaFactory.createForClass(PushCampaign);
