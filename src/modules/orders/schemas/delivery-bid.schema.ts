import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum DeliveryBidStatus {
  PENDING = 'pending',
  COUNTER_OFFER = 'counter_offer',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

@Schema({ timestamps: true })
export class DeliveryBid extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Order', required: true })
  order: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  rider: Types.ObjectId;

  @Prop({ required: true })
  bidAmount: number;
  
  @Prop()
  originalAmount?: number;

  @Prop()
  lastNegotiatorRole?: 'student' | 'errander';

  @Prop({ type: String, enum: DeliveryBidStatus, default: DeliveryBidStatus.PENDING })
  status: DeliveryBidStatus;
}

export const DeliveryBidSchema = SchemaFactory.createForClass(DeliveryBid);
