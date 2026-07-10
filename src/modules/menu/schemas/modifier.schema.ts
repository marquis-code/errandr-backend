import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: false })
export class ModifierOption {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, min: 0 })
  price: number;
}
export const ModifierOptionSchema = SchemaFactory.createForClass(ModifierOption);

@Schema({ timestamps: true })
export class Modifier extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Vendor', required: true })
  vendor: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop()
  optionGroup: string;

  @Prop({ type: [ModifierOptionSchema], required: true })
  items: ModifierOption[];

  @Prop({ min: 0, default: 0 })
  minSelection: number;

  @Prop({ required: true, min: 1, default: 1 })
  maxSelection: number;

  @Prop({ default: false })
  publishNow: boolean;
}

export const ModifierSchema = SchemaFactory.createForClass(Modifier);
ModifierSchema.index({ vendor: 1 });
