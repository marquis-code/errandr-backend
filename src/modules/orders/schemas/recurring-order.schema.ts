import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { OrderType, DeliveryOption, LocationType } from './order.schema';

export enum RecurringOrderStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  CANCELLED = 'cancelled',
}

export enum DayOfWeek {
  MONDAY = 'monday',
  TUESDAY = 'tuesday',
  WEDNESDAY = 'wednesday',
  THURSDAY = 'thursday',
  FRIDAY = 'friday',
  SATURDAY = 'saturday',
  SUNDAY = 'sunday',
}

@Schema({ timestamps: true })
export class RecurringOrder extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  customer: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Vendor' })
  vendor: Types.ObjectId;

  @Prop({ type: String, enum: OrderType, default: OrderType.MARKETPLACE })
  type: OrderType;

  @Prop({ type: String, enum: LocationType, default: LocationType.INSIDE_CAMPUS })
  locationType: LocationType;

  // -- Schedule Info --
  @Prop({
    type: [{
      day: { type: String, enum: Object.values(DayOfWeek) },
      timeWindow: String
    }],
    required: true
  })
  schedules: { day: DayOfWeek; timeWindow: string }[];

  @Prop({ type: String, enum: RecurringOrderStatus, default: RecurringOrderStatus.ACTIVE })
  status: RecurringOrderStatus;

  @Prop({ type: Date })
  lastRunAt: Date; // Keep track of last generated run

  @Prop({ type: String, enum: ['card', 'wallet'], default: 'wallet' })
  paymentMethod: string;

  // -- Order Details Template --
  @Prop({
    type: {
      pickupLocation: String,
      dropoffLocation: String,
      description: String,
      estimatedItemCost: { type: Number, default: 0 },
      urgency: { type: String, enum: ['standard', 'express'], default: 'standard' },
    },
  })
  customDetails: {
    pickupLocation: string;
    dropoffLocation: string;
    description: string;
    estimatedItemCost: number;
    urgency: 'standard' | 'express';
  };

  @Prop({
    type: [
      {
        product: { type: Types.ObjectId, ref: 'Product' },
        name: String,
        price: Number,
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
    default: [],
  })
  items: any[];

  @Prop({
    type: [
      {
        menuItem: { type: Types.ObjectId, ref: 'MenuItem' },
        name: String,
        price: Number,
        quantity: Number,
        subtotal: Number,
        variation: { name: String, price: Number },
        selectedModifiers: [
          { modifierName: String, options: [{ name: String, price: Number }] },
        ],
        selectedAddOns: [
          { addOnName: String, options: [{ name: String, price: Number }] },
        ],
      },
    ],
    default: [],
  })
  menuItems: any[];

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
              { name: String, selected: String, price: Number },
            ],
          },
        ],
      },
    ],
    default: [],
  })
  packs: any[];

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

  @Prop({ type: String, enum: ['room_delivery', 'dropoff_service'], default: 'room_delivery' })
  deliveryMode: 'room_delivery' | 'dropoff_service';

  @Prop()
  recipientName: string;

  @Prop()
  recipientPhone: string;

  @Prop()
  specificAddress: string;

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
  vendorNote: string;
  
  @Prop()
  deliveryNotes: string;
}

export const RecurringOrderSchema = SchemaFactory.createForClass(RecurringOrder);
RecurringOrderSchema.index({ customer: 1 });
RecurringOrderSchema.index({ vendor: 1 });
RecurringOrderSchema.index({ status: 1 });
RecurringOrderSchema.index({ 'schedules.day': 1 });
