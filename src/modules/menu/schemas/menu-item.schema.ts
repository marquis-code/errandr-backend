import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: false })
export class Variation {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, min: 0 })
  costPrice: number;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop()
  sku: string;

  @Prop({ required: true, min: 0, default: 0 })
  stock: number;
}
export const VariationSchema = SchemaFactory.createForClass(Variation);

@Schema({ timestamps: true })
export class MenuItem extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Vendor', required: true })
  vendor: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop({ type: Types.ObjectId, ref: 'MenuCategory' })
  category: Types.ObjectId;

  @Prop({ default: false })
  trackStock: boolean;

  @Prop({ min: 0, default: 0 })
  inStock: number;

  @Prop({ default: true })
  isAvailable: boolean;

  @Prop({ required: true, min: 0 })
  costPrice: number;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop()
  sku: string;

  @Prop({ type: [VariationSchema], default: [] })
  variations: Variation[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Modifier' }], default: [] })
  modifiers: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'AddOn' }], default: [] })
  addOns: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'MenuPack' }], default: [] })
  packs: Types.ObjectId[];

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ min: 0 })
  maxQuantity: number;

  @Prop({ min: 0 })
  maxQuantityAsSide: number;

  @Prop({ min: 0 })
  volumePerPortion: number;

  @Prop({ enum: ['kg', 'g', 'l', 'ml'], default: 'kg' })
  volumeUnit: string;

  @Prop({ default: 'portion' })
  portionUnit: string;

  @Prop()
  imageUrl: string;

  @Prop({ default: true })
  publishItem: boolean;
}

export const MenuItemSchema = SchemaFactory.createForClass(MenuItem);
MenuItemSchema.index({ vendor: 1 });
MenuItemSchema.index({ vendor: 1, category: 1 });
MenuItemSchema.index({ name: 'text', description: 'text', tags: 'text' });
