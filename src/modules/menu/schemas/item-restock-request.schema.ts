import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class ItemRestockRequest extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Vendor', required: true })
  vendor: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  item: Types.ObjectId;

  @Prop({ enum: ['MenuItem', 'Product'], required: true })
  itemModel: string;

  @Prop({ default: false })
  notified: boolean;
}

export const ItemRestockRequestSchema = SchemaFactory.createForClass(ItemRestockRequest);
ItemRestockRequestSchema.index({ user: 1, item: 1 }, { unique: true });
ItemRestockRequestSchema.index({ vendor: 1 });
