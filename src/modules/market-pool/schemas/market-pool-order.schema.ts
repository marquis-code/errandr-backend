import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum MarketPoolOrderStatus {
  PENDING_PAYMENT = 'pending_payment',
  PAYMENT_VERIFYING = 'payment_verifying',
  PAID = 'paid',
  PARTIALLY_REFUNDED = 'partially_refunded',
  PROCURING = 'procuring',
  REPACKAGING = 'repackaging',
  OUT_FOR_DELIVERY = 'out_for_delivery',
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

  @Prop()
  preferences?: string;
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

  @Prop({ type: String, enum: MarketPoolOrderStatus, default: MarketPoolOrderStatus.PENDING_PAYMENT })
  status: MarketPoolOrderStatus;

  @Prop({ type: String, enum: ['morning', 'afternoon'], default: 'morning' })
  deliverySlot: string;

  @Prop()
  proxyName: string;

  @Prop()
  proxyPhone: string;

  @Prop()
  paymentProofUrl: string;
}

export const MarketPoolOrderSchema = SchemaFactory.createForClass(MarketPoolOrder);
