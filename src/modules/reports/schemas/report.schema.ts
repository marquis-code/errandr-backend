import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum ReportStatus {
  PENDING = 'pending',
  INVESTIGATING = 'investigating',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

export enum ReportCategory {
  FOOD_QUALITY = 'food_quality',
  LATE_DELIVERY = 'late_delivery',
  WRONG_ORDER = 'wrong_order',
  RUDE_BEHAVIOR = 'rude_behavior',
  OVERCHARGING = 'overcharging',
  HYGIENE = 'hygiene',
  OTHER = 'other',
}

@Schema({ timestamps: true })
export class Report extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  reporter: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Vendor' })
  vendor: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  reportedUser: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Order' })
  order: Types.ObjectId;

  @Prop({ type: String, enum: ReportCategory, required: true })
  category: ReportCategory;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ type: String, enum: ReportStatus, default: ReportStatus.PENDING })
  status: ReportStatus;

  @Prop()
  adminNote: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  resolvedBy: Types.ObjectId;

  @Prop()
  resolvedAt: Date;

  // Chat thread for follow-up between student and admin
  @Prop({
    type: [
      {
        sender: { type: Types.ObjectId, ref: 'User' },
        message: String,
        timestamp: { type: Date, default: Date.now },
        isAdmin: { type: Boolean, default: false },
      },
    ],
    default: [],
  })
  thread: {
    sender: Types.ObjectId;
    message: string;
    timestamp: Date;
    isAdmin: boolean;
  }[];
}

export const ReportSchema = SchemaFactory.createForClass(Report);
ReportSchema.index({ reporter: 1 });
ReportSchema.index({ vendor: 1 });
ReportSchema.index({ status: 1 });
