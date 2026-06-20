import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class VendorReview extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Vendor', required: true })
  vendor: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Order', required: true })
  order: Types.ObjectId;

  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ required: false })
  comment: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const VendorReviewSchema = SchemaFactory.createForClass(VendorReview);
VendorReviewSchema.index({ vendor: 1, createdAt: -1 });
VendorReviewSchema.index({ user: 1, vendor: 1, order: 1 }, { unique: true });
