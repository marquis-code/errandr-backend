import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Modifier, ModifierSchema } from './modifier.schema';

/**
 * An à la carte menu item. Price is ALWAYS per single portion.
 * Cart quantity multiplies this — the schema never stores a
 * "2 portions" price; that's a cart-time calculation.
 */
@Schema({ timestamps: true })
export class MenuItem extends Document {
  @Prop({ required: true, trim: true })
  name: string; // e.g. "Fried Rice"

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: Types.ObjectId, ref: 'MenuCategory', required: true })
  categoryId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Vendor', required: true })
  vendorId: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  pricePerPortion: number; // the ONLY base price field

  @Prop({ default: 'plate' })
  portionUnit: string; // "plate", "wrap", "piece", "bottle"

  @Prop()
  image?: string;

  @Prop({ type: [String], default: [] })
  images?: string[];

  @Prop({ type: [String], default: [] })
  videos?: string[];

  @Prop({ type: [String], default: [] })
  tags?: string[];

  @Prop({ default: false })
  trackStock: boolean;

  @Prop({ default: false })
  isPrepaidByPlatform: boolean;


  @Prop({ default: 0 })
  stockQuantity: number;

  @Prop({ default: 0 })
  prepTimeMinutes: number;

  @Prop({ type: [ModifierSchema], default: [] })
  modifiers: Modifier[]; // required variant choices (spice level, swallow size)

  @Prop({ type: [Types.ObjectId], ref: 'AddOnGroup', default: [] })
  addOnGroupIds: Types.ObjectId[]; // optional extras, shared/reusable groups

  @Prop({ default: true })
  isAvailable: boolean; // vendor stockout toggle

  @Prop({ default: 0 })
  maxPortionsPerOrder: number; // 0 = no cap
}
export const MenuItemSchema = SchemaFactory.createForClass(MenuItem);
