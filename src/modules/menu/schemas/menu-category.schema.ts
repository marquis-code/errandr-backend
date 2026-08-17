import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class MenuCategory extends Document {
  @Prop({ required: true, trim: true })
  name: string; // e.g. "Rice Dishes"

  @Prop({ type: Types.ObjectId, ref: 'Vendor', required: true })
  vendorId: Types.ObjectId;

  @Prop({ default: 0 })
  sortOrder: number;

  @Prop({ default: true })
  isActive: boolean;
}
export const MenuCategorySchema = SchemaFactory.createForClass(MenuCategory);
MenuCategorySchema.index({ vendorId: 1, name: 1 }, { unique: true });
