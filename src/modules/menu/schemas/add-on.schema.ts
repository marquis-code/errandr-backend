import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: false })
export class AddOnOption {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, min: 0 })
  price: number;
}
export const AddOnOptionSchema = SchemaFactory.createForClass(AddOnOption);

@Schema({ timestamps: true })
export class AddOn extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Vendor', required: true })
  vendor: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ type: [AddOnOptionSchema], required: true })
  items: AddOnOption[];

  @Prop({ min: 0 })
  minSelection: number;

  @Prop({ required: true, min: 1, default: 1 })
  maxSelection: number;

  @Prop({ default: false })
  publishNow: boolean;
}

export const AddOnSchema = SchemaFactory.createForClass(AddOn);
AddOnSchema.index({ vendor: 1 });
