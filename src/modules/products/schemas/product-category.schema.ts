import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class ProductCategory extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Vendor', required: true })
  vendor: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop()
  image: string;

  @Prop({ default: 0 })
  sortOrder: number;

  @Prop({ default: true })
  isActive: boolean;
}

export const ProductCategorySchema = SchemaFactory.createForClass(ProductCategory);
ProductCategorySchema.index({ vendor: 1, name: 1 }, { unique: true });
