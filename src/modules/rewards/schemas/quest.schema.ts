import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum QuestType {
  ORDER_COUNT = 'order_count',
  DELIVERY_COUNT = 'delivery_count',
  STREAK = 'streak',
  SPEND_AMOUNT = 'spend_amount',
  NIGHT_OWL = 'night_owl',
  REFERRAL = 'referral',
}

@Schema({ timestamps: true })
export class Quest extends Document {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ type: String, enum: QuestType, required: true })
  type: QuestType;

  @Prop({ required: true })
  targetValue: number; // e.g., 5 orders

  @Prop({ required: true })
  rewardPoints: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  icon: string; // Emoji or Lucide icon name
}

export const QuestSchema = SchemaFactory.createForClass(Quest);
