import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum WaitlistStatus {
  PENDING = 'pending',
  NOTIFIED = 'notified',
  FULFILLED = 'fulfilled',
  CANCELLED = 'cancelled'
}

@Schema({ timestamps: true })
export class Waitlist extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Vendor', required: true })
  vendor: Types.ObjectId;

  @Prop({ required: false })
  user: Types.ObjectId;

  @Prop({ required: true })
  userEmail: string;

  @Prop({ required: true })
  userName: string;

  @Prop({ required: false })
  userPhone: string;

  @Prop({ required: true })
  date: string; // YYYY-MM-DD

  @Prop({ required: true })
  time: string; // HH:mm AM/PM

  @Prop({ type: Types.ObjectId, ref: 'Service', required: true })
  serviceId: Types.ObjectId;

  @Prop({ type: String, enum: WaitlistStatus, default: WaitlistStatus.PENDING })
  status: WaitlistStatus;
}

export const WaitlistSchema = SchemaFactory.createForClass(Waitlist);
