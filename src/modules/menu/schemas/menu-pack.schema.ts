import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * One line inside a Pack: a reference item + how many portions of it
 * are included. No price stored here — the Pack has ONE bundle price.
 */
@Schema({ _id: false })
export class PackComponent {
  @Prop({ type: Types.ObjectId, ref: 'MenuItem', required: true })
  itemId: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  portions: number; // e.g. 2 portions of Fried Rice inside this pack
}
export const PackComponentSchema = SchemaFactory.createForClass(PackComponent);

/**
 * A vendor-defined bundle at a FIXED price, independent of the sum
 * of its components' pricePerPortion. Extras (AddOnGroups) can still
 * be layered on top at cart time — e.g. "Extra Chicken" added to a pack.
 */
@Schema({ timestamps: true })
export class MenuPack extends Document {
  @Prop({ required: true, trim: true })
  name: string; // e.g. "Student Special"

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: Types.ObjectId, ref: 'MenuCategory', required: true })
  categoryId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Vendor', required: true })
  vendorId: Types.ObjectId;

  @Prop({ type: [PackComponentSchema], required: true })
  components: PackComponent[];

  @Prop({ required: true, min: 0 })
  bundlePrice: number; // vendor-set fixed price, NOT auto-summed

  @Prop({ type: [Types.ObjectId], ref: 'AddOnGroup', default: [] })
  addOnGroupIds: Types.ObjectId[]; // extras still applicable on a pack

  @Prop()
  imageUrl?: string;

  @Prop({ default: true })
  isAvailable: boolean;
}
export const MenuPackSchema = SchemaFactory.createForClass(MenuPack);
