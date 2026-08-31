import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum OrderStatus {
  SCHEDULED = 'scheduled',
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PREPARING = 'preparing',
  READY_FOR_PICKUP = 'ready_for_pickup',
  PICKED_UP = 'picked_up',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  AWAITING_PAYMENT = 'awaiting_payment',
  AWAITING_PAYMENT_CONFIRMATION = 'awaiting_payment_confirmation',
  NEGOTIATING = 'negotiating',
}

export enum LocationType {
  INSIDE_CAMPUS = 'inside_campus',
  CAMPUS_ENVIRONS = 'campus_environs',
  OUTSIDE_CAMPUS = 'outside_campus',
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
  /** @deprecated Self-pickup is no longer supported. Kept for legacy order compatibility. */
  PICKUP = 'pickup',
  USE_AN_ERRANDER = 'use_an_errander',
  BATCH_RUN = 'batch_run',
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

  @Prop({ type: String, enum: LocationType, default: LocationType.INSIDE_CAMPUS })
  locationType: LocationType;

  @Prop({ type: Number })
  proposedDeliveryFee?: number;

  @Prop({ type: Number })
  agreedDeliveryFee?: number;

  @Prop({
    type: {
      pickupLocation: String,
      dropoffLocation: String,
      description: String,
      attachedImage: String,
      attachedImages: [String],
      attachedVoiceNote: String,
      estimatedItemCost: { type: Number, default: 0 },
      itemCostBuffer: { type: Number, default: 0 },
      urgency: { type: String, enum: ['standard', 'express'], default: 'standard' },
    },
  })
  customDetails: {
    pickupLocation: string;
    dropoffLocation: string;
    description: string;
    attachedImage?: string;
    attachedImages?: string[];
    attachedVoiceNote?: string;
    estimatedItemCost: number;
    itemCostBuffer?: number;
    urgency: 'standard' | 'express';
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
            customizations: [
              {
                name: String,
                selected: String,
                price: Number,
              },
            ],
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
      customizations?: { name: string; selected: string; price: number }[];
    }[];
  }[];

  // ── Menu Items (Chowdeck-style, for food vendors) ──
  @Prop({
    type: [
      {
        menuItem: { type: Types.ObjectId, ref: 'MenuItem' },
        name: String,
        price: Number,
        quantity: Number,
        variation: {
          name: String,
          price: Number,
        },
        selectedModifiers: [
          {
            modifierName: String,
            options: [{ name: String, price: Number }],
          },
        ],
        selectedAddOns: [
          {
            addOnName: String,
            options: [{ name: String, price: Number }],
          },
        ],
        selectedPack: {
          name: String,
          price: Number,
        },
        subtotal: Number,
      },
    ],
    default: [],
  })
  menuItems: {
    menuItem: Types.ObjectId;
    name: string;
    price: number;
    quantity: number;
    variation?: { name: string; price: number };
    selectedModifiers: {
      modifierName: string;
      options: { name: string; price: number }[];
    }[];
    selectedAddOns: {
      addOnName: string;
      options: { name: string; price: number }[];
    }[];
    selectedPack?: { name: string; price: number };
    subtotal: number;
  }[];

  @Prop({ required: true })
  subtotal: number;

  @Prop({ default: 0 })
  deliveryFee: number;

  @Prop({ default: 0 })
  erranderPayout: number;

  @Prop({ default: 0 })
  serviceFee: number;

  @Prop({ default: 0 })
  platformProcessingFee: number;

  @Prop({ default: 300 })
  packagingFee: number;

  @Prop({
    type: {
      name: String,
      price: Number,
    },
  })
  selectedPack: {
    name: string;
    price: number;
  };

  @Prop({ default: 0 })
  discount: number;

  @Prop()
  promoCode: string;

  @Prop({ default: 0 })
  promoDiscount: number;

  @Prop({ default: false })
  isBirthdayDiscount: boolean;

  @Prop({ required: true })
  total: number;

  @Prop({ type: String, enum: DeliveryOption, default: DeliveryOption.USE_AN_ERRANDER })
  deliveryOption: DeliveryOption;

  @Prop({ type: String, enum: ['room_delivery', 'dropoff_service'], default: 'room_delivery' })
  deliveryMode: 'room_delivery' | 'dropoff_service';

  @Prop()
  recipientName: string;

  @Prop()
  vendorNote: string;

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

  @Prop({ type: String, enum: ['card', 'wallet', 'transfer'], default: 'card' })
  paymentMethod: string;

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

  @Prop({ default: 0 })
  vendorRating: number;

  @Prop()
  vendorReview: string;

  @Prop({ default: 0 })
  erranderRating: number;

  @Prop()
  erranderReview: string;

  @Prop({ default: false })
  hasRatedVendor: boolean;

  @Prop({ default: false })
  hasRatedErrander: boolean;

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

  @Prop({
    type: [{
      errander: { type: Types.ObjectId, ref: 'User' },
      amount: Number,
      status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
      timestamp: { type: Date, default: Date.now }
    }],
    default: []
  })
  bids: {
    _id?: any;
    errander: Types.ObjectId | any;
    amount: number;
    status: 'pending' | 'accepted' | 'rejected';
    timestamp: Date;
  }[];

  @Prop({
    type: [{
      errander: { type: Types.ObjectId, ref: 'User' },
      timestamp: { type: Date, default: Date.now }
    }],
    default: []
  })
  viewers: {
    errander: Types.ObjectId | any;
    timestamp: Date;
  }[];

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: 0 })
  vendorShare: number;

  @Prop({ default: 0 })
  erranderShare: number;

  @Prop({ default: 0 })
  platformShare: number;

  @Prop({ default: 5 })
  foodMarkupPercentage: number;

  // Group Buying
  @Prop({ default: false })
  isGroupOrder: boolean;

  @Prop()
  groupId: string;

  @Prop({ default: 0 })
  groupDiscount: number;

  @Prop({ default: false })
  isGroupLeader: boolean;

  @Prop({ default: false })
  isMysteryBox: boolean;

  @Prop({ default: false })
  isDormDelivery: boolean;

  // Custom Errand Pooling
  @Prop({ default: false })
  isPooledErrand: boolean;

  @Prop({ type: Types.ObjectId, ref: 'ErrandPool' })
  errandPoolId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ErrandPool' })
  intendedPoolId: Types.ObjectId;

  @Prop({ default: false })
  intendsToCreatePool: boolean;
  
  @Prop()
  deliveryOtpHash: string;

  @Prop({ type: String, enum: ['pending', 'transferred', 'failed', 'not_applicable'], default: 'not_applicable' })
  itemCostDisbursementStatus: 'pending' | 'transferred' | 'failed' | 'not_applicable';

  @Prop()
  itemCostTransferReference: string;

  @Prop({ default: 0 })
  transferFee: number;

  // Delivery Verification (Privacy)
  @Prop()
  deliveryPin: string;

  @Prop({ type: String, enum: ['pending', 'verified', 'bypassed_contactless'], default: 'pending' })
  deliveryPinStatus: 'pending' | 'verified' | 'bypassed_contactless';

  @Prop()
  contactlessDropoffImage: string;

  // Reconciliation fields
  @Prop()
  actualItemCost: number;

  @Prop()
  receiptImage: string;

  @Prop({ type: String, enum: ['not_applicable', 'pending', 'submitted', 'approved', 'disputed'], default: 'not_applicable' })
  reconciliationStatus: 'not_applicable' | 'pending' | 'submitted' | 'approved' | 'disputed';

  @Prop()
  reconciliationNote: string;

  @Prop({ default: 0 })
  refundAmount: number;

  @Prop({ default: 0 })
  shortfallAmount: number;

  @Prop()
  abandonmentFeedback: string;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
OrderSchema.index({ customer: 1 });
OrderSchema.index({ vendor: 1 });
OrderSchema.index({ errander: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ orderNumber: 1 });
OrderSchema.index({ deliveryLocation: '2dsphere' });
