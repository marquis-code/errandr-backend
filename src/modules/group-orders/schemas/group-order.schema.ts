import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { Vendor } from '../../vendors/schemas/vendor.schema';

@Schema({ timestamps: true })
export class GroupOrderItem {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Product', required: true })
  productId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  price: number;

  @Prop({ default: 1 })
  quantity: number;

  @Prop({ type: [Object], default: [] })
  customizations: any[];

  @Prop()
  image: string;
}

@Schema()
export class GroupOrderParticipant {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  user: User | MongooseSchema.Types.ObjectId;

  @Prop({ type: [GroupOrderItem], default: [] })
  items: GroupOrderItem[];

  @Prop({ default: false })
  isReady: boolean;

  @Prop({ default: 0 })
  total: number;

  @Prop({ default: false })
  hasPaid: boolean;
}

export type GroupOrderDocument = GroupOrder & Document;

@Schema({ timestamps: true })
export class GroupOrder {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Vendor', required: true })
  vendor: Vendor | MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  host: User | MongooseSchema.Types.ObjectId;

  @Prop({ required: true, unique: true })
  inviteCode: string;

  @Prop({
    type: String,
    enum: ['open', 'locked', 'completed', 'cancelled'],
    default: 'open',
  })
  status: string;

  @Prop({
    type: String,
    enum: ['sponsor', 'split_bill'],
    default: 'sponsor',
  })
  splitType: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  sponsorId: User | MongooseSchema.Types.ObjectId;

  @Prop({ type: [GroupOrderParticipant], default: [] })
  participants: GroupOrderParticipant[];

  @Prop()
  name: string;

  @Prop()
  spendingLimit: number;

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Order' }], default: [] })
  orders: (MongooseSchema.Types.ObjectId | any)[];

  @Prop()
  expiresAt: Date;
}

export const GroupOrderSchema = SchemaFactory.createForClass(GroupOrder);
