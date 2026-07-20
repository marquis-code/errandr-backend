import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * A single selectable extra inside an AddOnGroup.
 * e.g. "Extra Chicken" -> ₦1,500
 */
@Schema({ _id: true })
export class AddOnOption {
  @Prop({ required: true, trim: true })
  name: string; // e.g. "Extra Chicken"

  @Prop({ required: true, min: 0 })
  price: number; // additive price, NOT a portion price

  @Prop({ default: true })
  isAvailable: boolean;
}
export const AddOnOptionSchema = SchemaFactory.createForClass(AddOnOption);

/**
 * A reusable group of extras, e.g. "Extra Protein", "Extra Sides".
 * Attachable to BOTH Items and Packs (many-to-many via reference),
 * so "Extra Chicken" doesn't need to be redefined per item.
 */
@Schema({ timestamps: true })
export class AddOnGroup extends Document {
  @Prop({ required: true, trim: true })
  name: string; // e.g. "Extra Protein"

  @Prop({ required: true, enum: ['single', 'multi'], default: 'multi' })
  selectionType: 'single' | 'multi';

  @Prop({ default: 0 })
  minSelect: number; // 0 = fully optional

  @Prop({ type: Number, default: null })
  maxSelect: number | null; // null = unlimited

  @Prop({ type: [AddOnOptionSchema], default: [] })
  options: AddOnOption[];

  @Prop({ type: Types.ObjectId, ref: 'Vendor', required: true })
  vendorId: Types.ObjectId;

  @Prop({ default: true })
  isActive: boolean;
}
export const AddOnGroupSchema = SchemaFactory.createForClass(AddOnGroup);
