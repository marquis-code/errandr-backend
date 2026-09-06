import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum AppointmentStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
}

@Schema({ timestamps: true })
export class Appointment extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User' })
  user?: Types.ObjectId;

  @Prop({
    type: {
      firstName: { type: String },
      lastName: { type: String },
      email: { type: String },
      phone: { type: String },
    },
    required: false
  })
  guestInfo?: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };

  @Prop({ type: Types.ObjectId, ref: 'Vendor', required: true })
  vendor: Types.ObjectId;

  @Prop([{
    service: { type: Types.ObjectId, ref: 'Service', required: true },
    variantName: { type: String },
    extras: [{
      name: { type: String, required: true },
      price: { type: Number, required: true },
      durationInMinutes: { type: Number, default: 0 }
    }],
    price: { type: Number, required: true },
    durationInMinutes: { type: Number, required: true }
  }])
  items: {
    service: Types.ObjectId;
    variantName?: string;
    extras?: { name: string; price: number; durationInMinutes: number }[];
    price: number;
    durationInMinutes: number;
  }[];

  @Prop({ required: true })
  scheduledDate: Date;

  @Prop({ required: true })
  startTime: string; // e.g., '14:30'

  @Prop({ required: true })
  endTime: string; // e.g., '15:00'

  @Prop({ required: true })
  price: number; // Total price

  @Prop({ required: true, default: 0 })
  commitmentFee: number; // Amount paid upfront

  @Prop({ required: true, default: 0 })
  pendingBalance: number; // Amount to be paid in person

  @Prop({ type: String, enum: AppointmentStatus, default: AppointmentStatus.PENDING })
  status: AppointmentStatus;

  @Prop()
  notes: string;

  // Optional: tracking team member assigned
  @Prop({ type: Types.ObjectId, ref: 'User' })
  staffMember: Types.ObjectId;

  @Prop({ default: 'pending' })
  paymentStatus: string;

  @Prop()
  paymentReference: string;

  @Prop({ type: String, enum: ['paystack', 'direct_transfer'], default: 'paystack' })
  paymentMethod: string;

  @Prop({ type: String })
  proofOfPayment: string;

  @Prop({ default: false })
  reminderSent24h: boolean;

  @Prop({ default: false })
  reminderSent1h: boolean;
}

export const AppointmentSchema = SchemaFactory.createForClass(Appointment);
AppointmentSchema.index({ vendor: 1, scheduledDate: 1 });
AppointmentSchema.index({ user: 1 });
