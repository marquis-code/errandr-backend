import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Favorite extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Product' })
  product: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Vendor' })
  vendor: Types.ObjectId;

  @Prop()
  note: string;
}

export const FavoriteSchema = SchemaFactory.createForClass(Favorite);
FavoriteSchema.index(
  { user: 1, product: 1 }, 
  { unique: true, partialFilterExpression: { product: { $type: 'objectId' } } }
);
FavoriteSchema.index(
  { user: 1, vendor: 1 }, 
  { unique: true, partialFilterExpression: { vendor: { $type: 'objectId' } } }
);
FavoriteSchema.index({ user: 1 });
