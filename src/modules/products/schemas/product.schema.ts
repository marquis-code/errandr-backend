import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';

@Schema({ timestamps: true })
export class Product extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Vendor', required: true })
  vendor: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'GlobalProduct', required: false })
  globalProductId?: Types.ObjectId;

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

  @Prop({ type: [String], default: [] })
  videos: string[];

  @Prop({ required: true })
  category: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ default: true })
  isAvailable: boolean;

  @Prop({ default: false })
  isFeatured: boolean;

  @Prop({ default: false })
  isPinned: boolean;

  @Prop({ default: 0 })
  orderCount: number;

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

  // ── Modifiers (e.g. Choose Protein, usually required) ──
  @Prop({
    type: [
      {
        name: { type: String },
        minSelection: { type: Number, default: 0 },
        maxSelection: { type: Number, default: 1 },
        items: [
          {
            name: { type: String },
            price: { type: Number, default: 0 },
          },
        ],
      },
    ],
    default: [],
  })
  modifiers: {
    name: string;
    minSelection: number;
    maxSelection: number;
    items: { name: string; price: number }[];
  }[];

  // ── Add-Ons (e.g. Extra Sauces, usually optional) ──
  @Prop({
    type: [
      {
        name: { type: String },
        minSelection: { type: Number, default: 0 },
        maxSelection: { type: Number, default: 10 },
        items: [
          {
            name: { type: String },
            price: { type: Number, default: 0 },
          },
        ],
      },
    ],
    default: [],
  })
  addOns: {
    name: string;
    minSelection: number;
    maxSelection: number;
    items: { name: string; price: number }[];
  }[];

  // ── Chowdeck-style: Inventory Tracking ──
  @Prop({ default: false })
  trackStock: boolean;

  @Prop()
  costPrice: number; // Cost price for profit calculation

  @Prop()
  sku: string; // SKU for internal tracking

  // ── Variations (e.g. Glass vs Bottle of same item) ──
  @Prop({
    type: [
      {
        name: { type: String },
        costPrice: { type: Number, default: 0 },
        price: { type: Number, default: 0 },
        sku: { type: String },
        stock: { type: Number, default: 0 },
      },
    ],
    default: [],
  })
  variations: {
    name: string;
    costPrice: number;
    price: number;
    sku: string;
    stock: number;
  }[];

  // ── Packs (packaging type for delivery) ──
  @Prop({ type: [String], default: [] })
  packs: string[];

  // ── Advanced Quantity Constraints ──
  @Prop()
  maxQuantity: number;

  @Prop()
  maxQuantityAsSide: number;

  @Prop()
  volumePerPortion: string; // e.g. "1kg"

  @Prop({ default: 0 })
  totalOrders: number;

  @Prop({ default: 0 })
  rating: number;

  // ── Pre-Order Support ──
  @Prop({ default: false })
  isPreOrder: boolean;

  @Prop()
  preOrderDeadline: Date;

  @Prop()
  availableDate: Date;

  @Prop()
  preOrderNote: string; // e.g. "Order by Friday 5pm for Saturday delivery"
}

export const ProductSchema = SchemaFactory.createForClass(Product);
ProductSchema.index({ vendor: 1 });
ProductSchema.index({ category: 1 });
ProductSchema.index({ name: 'text', description: 'text' });
