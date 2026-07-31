import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum ErrandPoolStatus {
  OPEN = 'open',         // Accepting more participants
  LOCKED = 'locked',     // Assigned to an errander, no more joining
  IN_PROGRESS = 'in_progress', 
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

@Schema({ timestamps: true })
export class ErrandPool extends Document {
  @Prop({ required: true, unique: true })
  poolCode: string;

  @Prop({ required: true })
  title: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  creator: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  errander: Types.ObjectId;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'Order' }],
    default: []
  })
  orders: Types.ObjectId[];

  @Prop({ type: String, enum: ErrandPoolStatus, default: ErrandPoolStatus.OPEN })
  status: ErrandPoolStatus;

  @Prop({ required: true })
  baseDeliveryFee: number; 

  @Prop({ default: 4 })
  maxParticipants: number;

  @Prop()
  expiresAt: Date;
}

export const ErrandPoolSchema = SchemaFactory.createForClass(ErrandPool);
