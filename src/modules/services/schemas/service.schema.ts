import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Service extends Document {
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
  image: string;

  @Prop()
  video: string;

  @Prop({ required: true })
  category: string;

  @Prop({ default: true })
  isAvailable: boolean;

  @Prop({ required: true, default: 30 })
  durationInMinutes: number; // e.g., 30, 60, 120

  @Prop({ default: 0 })
  paddingTimeInMinutes: number; // buffer time before/after the service

  @Prop({ default: 0 })
  totalBookings: number;

  @Prop({ default: 0 })
  rating: number;

  @Prop([{
    name: { type: String, required: true },
    price: { type: Number, required: true },
    durationInMinutes: { type: Number, required: true },
    image: { type: String, required: false },
    video: { type: String, required: false }
  }])
  variants: { name: string; price: number; durationInMinutes: number; image?: string; video?: string }[];

  @Prop([{
    name: { type: String, required: true },
    price: { type: Number, required: true },
    durationInMinutes: { type: Number, default: 0 }
  }])
  extras: { name: string; price: number; durationInMinutes: number }[];
}

export const ServiceSchema = SchemaFactory.createForClass(Service);
ServiceSchema.index({ vendor: 1 });
ServiceSchema.index({ category: 1 });
ServiceSchema.index({ name: 'text', description: 'text' });
