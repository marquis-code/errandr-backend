import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Product extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Vendor', required: true })
  vendor: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop({ required: true })
  price: number;

  @Prop()
  discountPrice: number;

  @Prop()
  discountPercentage: number;

  @Prop()
  image: string;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ required: true })
  category: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ default: true })
  isAvailable: boolean;

  @Prop({ default: false })
  isFeatured: boolean;

  @Prop({ default: 0 })
  preparationTime: number; // minutes

  // ── Serving & Portion Details ──
  @Prop()
  servingSize: string; // e.g. "1 plate", "1 wrap", "500ml"

  @Prop()
  portionInfo: string; // e.g. "Feeds 1 person", "Family size"

  @Prop()
  calories: string; // e.g. "450 kcal"

  @Prop({ type: [String], default: [] })
  allergens: string[]; // e.g. ["Gluten", "Dairy", "Nuts"]

  // ── Stock / Inventory ──
  @Prop({ default: -1 })
  stockQuantity: number; // -1 = unlimited

  @Prop({ default: 1 })
  minOrderQty: number;

  @Prop({ default: 10 })
  maxOrderQty: number;

  // ── Customizations (add-ons, options) ──
  @Prop({
    type: [
      {
        name: { type: String },
        options: [
          {
            label: { type: String },
            price: { type: Number, default: 0 },
          },
        ],
      },
    ],
    default: [],
  })
  customizations: {
    name: string;
    options: { label: string; price: number }[];
  }[];

  @Prop({ default: 0 })
  totalOrders: number;

  @Prop({ default: 0 })
  rating: number;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
ProductSchema.index({ vendor: 1 });
ProductSchema.index({ category: 1 });
ProductSchema.index({ name: 'text', description: 'text' });
