import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum VendorCategory {
  RESTAURANT = 'restaurant',
  EATERY = 'eatery',
  SNACKS = 'snacks',
  DRINKS = 'drinks',
  GROCERIES = 'groceries',
  BAKERY = 'bakery',
  PHARMACY = 'pharmacy',
  STATIONERY = 'stationery',
  OTHER = 'other',
}

export enum VendorStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  SUSPENDED = 'suspended',
  REJECTED = 'rejected',
}

@Schema({ timestamps: true })
export class Vendor extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  owner: Types.ObjectId;

  @Prop({ required: true })
  storeName: string;

  @Prop({ unique: true, sparse: true, lowercase: true, trim: true })
  subdomain: string;

  @Prop()
  description: string;

  @Prop()
  logo: string;

  @Prop()
  banner: string;

  @Prop({ required: true })
  category: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop()
  phone: string;

  @Prop()
  address: string;

  @Prop({ default: false })
  isInsideCampus: boolean;

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
  location: {
    type: string;
    coordinates: number[];
  };

  @Prop({ type: String, enum: VendorStatus, default: VendorStatus.APPROVED })
  status: VendorStatus;

  @Prop({ default: true })
  isOnline: boolean;

  @Prop({
    type: [
      {
        day: { type: String }, // 'monday', 'tuesday', etc.
        open: { type: String, default: '08:00' },
        close: { type: String, default: '21:00' },
        isClosed: { type: Boolean, default: false },
      },
    ],
    default: [
      { day: 'monday', open: '00:00', close: '23:59', isClosed: false },
      { day: 'tuesday', open: '00:00', close: '23:59', isClosed: false },
      { day: 'wednesday', open: '00:00', close: '23:59', isClosed: false },
      { day: 'thursday', open: '00:00', close: '23:59', isClosed: false },
      { day: 'friday', open: '00:00', close: '23:59', isClosed: false },
      { day: 'saturday', open: '00:00', close: '23:59', isClosed: false },
      { day: 'sunday', open: '00:00', close: '23:59', isClosed: false },
    ],
  })
  businessHours: {
    day: string;
    open: string;
    close: string;
    isClosed: boolean;
  }[];

  @Prop({
    type: {
      start: { type: String, default: '14:00' },
      end: { type: String, default: '15:00' },
      enabled: { type: Boolean, default: false },
    },
  })
  breakPeriod: {
    start: string;
    end: string;
    enabled: boolean;
  };

  @Prop({ default: 0 })
  rating: number;

  @Prop({ default: 0 })
  totalOrders: number;

  @Prop({ default: 0 })
  totalRatings: number;

  @Prop({ default: 0 })
  preparationTime: number; // average in minutes

  @Prop({ default: 0 })
  deliveryFee: number;

  @Prop({ default: 600 })
  baseDeliveryFee: number;

  @Prop({
    type: [
      {
        name: { type: String, required: true },
        price: { type: Number, required: true, default: 0 },
        isActive: { type: Boolean, default: true },
      },
    ],
    default: [{ name: 'Standard Pack', price: 300, isActive: true }],
  })
  packs: {
    name: string;
    price: number;
    isActive: boolean;
  }[];

  @Prop({ default: 300 })
  packagingFee: number;

  @Prop({ default: 0 })
  minimumOrder: number;

  // Student Entrepreneur fields
  @Prop({ default: false })
  isStudentBusiness: boolean;

  @Prop()
  matricNumber: string;

  @Prop()
  university: string;

  // Pre-order support
  @Prop({ default: false })
  preOrderOnly: boolean;

  @Prop({ default: 0 })
  preOrderLeadTime: number; // hours in advance needed

  @Prop({ type: [String], default: [] })
  preOrderDays: string[]; // days accepting pre-orders

  // Bank details for payouts
  @Prop({
    type: {
      bankName: String,
      accountNumber: String,
      accountName: String,
    },
  })
  bankDetails: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };

  // Social media
  @Prop({
    type: {
      whatsapp: String,
      instagram: String,
      twitter: String,
    },
  })
  socialMedia: {
    whatsapp: string;
    instagram: string;
    twitter: string;
  };

  @Prop({ default: false })
  isFeatured: boolean;

  @Prop({ type: [String], default: [] })
  offers: string[];

  @Prop({
    type: [
      {
        image: { type: String },
        title: { type: String },
        description: { type: String },
        link: { type: String },
        isActive: { type: Boolean, default: true },
        startAt: { type: Date },
        endAt: { type: Date },
        products: { type: [{ type: Types.ObjectId, ref: 'Product' }], default: [] },
      },
    ],
    default: [],
  })
  banners: {
    image: string;
    title: string;
    description: string;
    link: string;
    isActive: boolean;
    startAt?: Date;
    endAt?: Date;
    products?: Types.ObjectId[] | string[];
  }[];

  // ── Pre-Order Batch Schedule ──
  @Prop({
    type: [
      {
        windowName: String,
        deadline: Date,
        deliveryDate: Date,
        isActive: { type: Boolean, default: true },
      },
    ],
    default: [],
  })
  batchSchedule: {
    windowName: string;
    deadline: Date;
    deliveryDate: Date;
    isActive: boolean;
  }[];
}

export const VendorSchema = SchemaFactory.createForClass(Vendor);
VendorSchema.index({ location: '2dsphere' });
VendorSchema.index({ category: 1 });
VendorSchema.index({ isOnline: 1, status: 1 });
VendorSchema.index({ subdomain: 1 }, { unique: true, sparse: true });
