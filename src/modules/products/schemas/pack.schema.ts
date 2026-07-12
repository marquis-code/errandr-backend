import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';

@Schema({ timestamps: true })
export class Pack extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Vendor', required: true })
  vendorId: Types.ObjectId;

  @Prop({ required: true }) 
  name: string;

  @Prop() 
  description?: string;

  @Prop() 
  image?: string;

  @Prop([{ 
    itemId: { type: MongooseSchema.Types.ObjectId, ref: 'Product' }, 
    quantity: { type: Number, default: 1 } 
  }])
  items: { itemId: Types.ObjectId; quantity: number }[];

  @Prop({ default: 0 }) 
  discountPercent?: number;

  @Prop({ enum: ['manual', 'auto'], default: 'manual' }) 
  source: string;

  @Prop({ default: true }) 
  isActive: boolean;

  @Prop({ default: 0 }) 
  orderCount: number;
}

export const PackSchema = SchemaFactory.createForClass(Pack);
