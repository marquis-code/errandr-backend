import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class GlobalProduct extends Document {
  @Prop({ required: true })
  name: string;

  @Prop()
  image?: string;

  @Prop({ type: Types.ObjectId, ref: 'ProductCategory' })
  categoryId?: Types.ObjectId;

  @Prop({ enum: ['manual', 'promoted'], default: 'manual' })
  source: string;

  @Prop({ default: 0 })
  vendorAdoptionCount: number;

  @Prop({ default: true })
  isActive: boolean;
}

export const GlobalProductSchema = SchemaFactory.createForClass(GlobalProduct);
GlobalProductSchema.index({ name: 'text' });
GlobalProductSchema.index({ categoryId: 1 });
