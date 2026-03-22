import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PREPARING = 'preparing',
  READY_FOR_PICKUP = 'ready_for_pickup',
  PICKED_UP = 'picked_up',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum OrderType {
  MARKETPLACE = 'marketplace',
  CUSTOM_ERRAND = 'custom_errand',
}

export enum DeliveryOption {
  PICKUP = 'pickup',
  USE_AN_ERRANDER = 'use_an_errander',
}

@Schema({ timestamps: true })
export class Order extends Document {
  @Prop({ required: true, unique: true })
  orderNumber: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  customer: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Vendor' })
  vendor: Types.ObjectId;

  @Prop({ type: String, enum: OrderType, default: OrderType.MARKETPLACE })
  type: OrderType;

  @Prop({
    type: {
      pickupLocation: String,
      dropoffLocation: String,
      description: String,
    },
  })
  customDetails: {
    pickupLocation: string;
    dropoffLocation: string;
    description: string;
  };

  @Prop({ type: Types.ObjectId, ref: 'User' })
  errander: Types.ObjectId;

  @Prop({
    type: [
      {
        product: { type: Types.ObjectId, ref: 'Product' },
        name: String,
        price: Number,
        quantity: Number,
        customizations: [
          {
            name: String,
            selected: String,
            price: Number,
          },
        ],
        subtotal: Number,
      },
    ],
    default: [],
  })
  items: {
    product: Types.ObjectId;
    name: string;
    price: number;
    quantity: number;
    customizations: { name: string; selected: string; price: number }[];
    subtotal: number;
  }[];

  @Prop({
    type: [
      {
        packId: String,
        name: String,
        items: [
          {
            product: { type: Types.ObjectId, ref: 'Product' },
            name: String,
            price: Number,
            image: String,
            quantity: Number,
            subtotal: Number,
          },
        ],
      },
    ],
    default: [],
  })
  packs: {
    packId: string;
    name?: string;
    items: {
      product: Types.ObjectId;
      name: string;
      price: number;
      image: string;
      quantity: number;
      subtotal: number;
    }[];
  }[];

  @Prop({ required: true })
  subtotal: number;

  @Prop({ default: 0 })
  deliveryFee: number;

  @Prop({ default: 0 })
  serviceFee: number;

  @Prop({ default: 300 })
  packagingFee: number;

  @Prop({ required: true })
  total: number;

  @Prop({ type: String, enum: DeliveryOption, default: DeliveryOption.USE_AN_ERRANDER })
  deliveryOption: DeliveryOption;

  @Prop()
  recipientName: string;

  @Prop()
  recipientPhone: string;

  @Prop()
  specificAddress: string;

  @Prop({ type: String, enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Prop({ type: String, enum: PaymentStatus, default: PaymentStatus.PENDING })
  paymentStatus: PaymentStatus;

  @Prop()
  paymentReference: string;

  @Prop()
  deliveryAddress: string;

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      default: [0, 0],
    },
  })
  deliveryLocation: {
    type: string;
    coordinates: number[];
  };

  @Prop()
  deliveryNotes: string;

  @Prop()
  estimatedDeliveryTime: Date;

  @Prop()
  actualDeliveryTime: Date;

  @Prop({ default: 0 })
  rating: number;

  @Prop()
  review: string;

  @Prop({
    type: [
      {
        status: { type: String, enum: Object.values(OrderStatus) },
        timestamp: { type: Date, default: Date.now },
        note: String,
      },
    ],
    default: [],
  })
  statusHistory: {
    status: OrderStatus;
    timestamp: Date;
    note: string;
  }[];

  @Prop({ default: false })
  isBroadcasted: boolean;

  @Prop({ default: 0 })
  broadcastAttempts: number;

  // Pre-order support
  @Prop({ default: false })
  isPreOrder: boolean;

  @Prop()
  scheduledTime: Date;

  @Prop()
  scheduledDate: string;

  // Re-order tracking
  @Prop({ default: false })
  isReorder: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Order' })
  originalOrderId: Types.ObjectId;

  // Cancellation
  @Prop()
  cancelReason: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  cancelledBy: Types.ObjectId;

  // Real-time Wallet & Verification
  @Prop({ required: true, default: () => Math.random().toString(36).substring(2, 8).toUpperCase() })
  uniqueCode: string;

  @Prop({ default: 0 })
  weight: number; // in kg

  @Prop({ default: 0 })
  vendorShare: number;

  @Prop({ default: 0 })
  erranderShare: number;

  @Prop({ default: 0 })
  platformShare: number;

  // Group Buying
  @Prop({ default: false })
  isGroupOrder: boolean;

  @Prop()
  groupId: string;

  @Prop({ default: 0 })
  groupDiscount: number;

  @Prop({ default: false })
  isGroupLeader: boolean;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
OrderSchema.index({ customer: 1 });
OrderSchema.index({ vendor: 1 });
OrderSchema.index({ errander: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ orderNumber: 1 });
OrderSchema.index({ deliveryLocation: '2dsphere' });
