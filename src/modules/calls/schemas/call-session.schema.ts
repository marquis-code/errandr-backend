import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CallSessionDocument = CallSession & Document;

export enum CallType {
  VOICE = 'voice',
  VIDEO = 'video',
}

export enum CallStatus {
  RINGING = 'ringing',
  ACTIVE = 'active',
  ENDED = 'ended',
  DECLINED = 'declined',
  MISSED = 'missed',
}

/**
 * One call between two people about one order.
 *
 * Stored rather than held only in memory: a support agent needs to see that a customer
 * tried to reach their errand ninja twice and got no answer, and an order dispute is
 * decided partly on whether anyone actually picked up.
 */
@Schema({ timestamps: true })
export class CallSession {
  @Prop({ type: Types.ObjectId, ref: 'Order', required: true, index: true })
  order: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  caller: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  callee: Types.ObjectId;

  @Prop({ type: String, enum: CallType, default: CallType.VOICE })
  type: CallType;

  @Prop({ type: String, enum: CallStatus, default: CallStatus.RINGING, index: true })
  status: CallStatus;

  /** Set when the callee answers; drives the duration that is reported. */
  @Prop({ type: Date })
  answeredAt?: Date;

  @Prop({ type: Date })
  endedAt?: Date;

  @Prop({ type: Number, default: 0 })
  durationSeconds: number;

  /** Which side hung up, so a dispute can tell a dropped call from a refused one. */
  @Prop({ type: Types.ObjectId, ref: 'User' })
  endedBy?: Types.ObjectId;
}

export const CallSessionSchema = SchemaFactory.createForClass(CallSession);

// Call history is always read per order, newest first.
CallSessionSchema.index({ order: 1, createdAt: -1 });
