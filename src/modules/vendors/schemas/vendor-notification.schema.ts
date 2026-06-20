import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Vendor } from './vendor.schema';

@Schema({ timestamps: true })
export class VendorNotification extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Vendor', required: true })
  vendorId: Types.ObjectId | Vendor;

  @Prop({ required: true })
  email: string;

  @Prop({ type: Object, required: false })
  pushSubscription?: any;

  @Prop({ default: false })
  isNotified: boolean;
}

export const VendorNotificationSchema = SchemaFactory.createForClass(VendorNotification);
