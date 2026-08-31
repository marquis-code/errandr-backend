import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum MarketPoolOrderStatus {
  PAID = 'paid',
  PARTIALLY_REFUNDED = 'partially_refunded',
  DELIVERED = 'delivered',
}

@Schema({ _id: false })
export class MarketPoolOrderItem {
  @Prop({ type: Types.ObjectId, ref: 'MarketPoolItem', required: true })
  itemId: Types.ObjectId;

  @Prop({ required: true })
  quantity: number;

  @Prop({ required: true })
  priceAtPurchase: number;
}
export const MarketPoolOrderItemSchema = SchemaFactory.createForClass(MarketPoolOrderItem);

@Schema({ timestamps: true })
export class MarketPoolOrder extends Document {
  @Prop({ type: Types.ObjectId, ref: 'MarketPoolCampaign', required: true })
  campaignId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: [MarketPoolOrderItemSchema], required: true })
  items: MarketPoolOrderItem[];

  @Prop({ required: true })
  totalItemCost: number;

  @Prop({ required: true })
  deliveryFee: number;

  @Prop({ type: String, enum: MarketPoolOrderStatus, default: MarketPoolOrderStatus.PAID })
  status: MarketPoolOrderStatus;
}

export const MarketPoolOrderSchema = SchemaFactory.createForClass(MarketPoolOrder);
