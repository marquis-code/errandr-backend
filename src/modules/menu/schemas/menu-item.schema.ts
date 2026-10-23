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

  @Prop({ default: false })
  isPackagingFeeIncluded: boolean;
  @Prop({ default: 0 })
  stockQuantity: number;

  @Prop({ default: 0 })
  prepTimeMinutes: number;

  @Prop({ type: [ModifierSchema], default: [] })
  modifiers: Modifier[]; // required variant choices (spice level, swallow size)

  @Prop({ type: [Types.ObjectId], ref: 'AddOnGroup', default: [] })
  addOnGroupIds: Types.ObjectId[]; // optional extras, shared/reusable groups

  /**
   * Add-on options that are free when bought *with this item*, while still costing money
   * on their own.
   *
   * Ofada By Joke's case: the sauce is included when you buy the rice, but a customer who
   * orders sauce alone pays for it. The price stays on the add-on option; this only marks
   * where it is waived, and `maxFree` caps how many are waived per line so buying two
   * plates does not hand over two free sauces by accident.
   */
  @Prop({
    type: [
      {
        groupId: { type: Types.ObjectId, ref: 'AddOnGroup' },
        optionName: { type: String },
        maxFree: { type: Number, default: 1 },
      },
    ],
    default: [],
  })
  freeAddOns: { groupId: Types.ObjectId; optionName: string; maxFree: number }[];

  @Prop({ default: true })
  isAvailable: boolean; // vendor stockout toggle

  @Prop({ default: 0 })
  maxPortionsPerOrder: number; // 0 = no cap
}
export const MenuItemSchema = SchemaFactory.createForClass(MenuItem);
