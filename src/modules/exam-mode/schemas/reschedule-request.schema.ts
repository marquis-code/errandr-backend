import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum RescheduleStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  CUSTOMER_REJECTED = 'customer_rejected',
  MANUALLY_RESOLVED = 'manually_resolved'
}

@Schema({ timestamps: true })
export class RescheduleRequest extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Order', required: true })
  orderId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Vendor', required: true })
  vendorId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  customerId: Types.ObjectId;

  @Prop({ required: true })
  originalDate: Date;

  @Prop({ required: true })
  suggestedDate: Date;

  @Prop({ type: String, enum: RescheduleStatus, default: RescheduleStatus.PENDING })
  status: RescheduleStatus;

  @Prop({ type: String, enum: ['whatsapp', 'sms', 'push'], default: 'push' })
  notifiedVia: string;
}

export const RescheduleRequestSchema = SchemaFactory.createForClass(RescheduleRequest);
