import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum VendorCategory {
  // Physical Products
  RESTAURANT = 'restaurant',
  EATERY = 'eatery',
  SNACKS = 'snacks',
  DRINKS = 'drinks',
  GROCERIES = 'groceries',
  BAKERY = 'bakery',
  PHARMACY = 'pharmacy',
  STATIONERY = 'stationery',
  
  // Services
  HAIR_SALON = 'hair_salon',
  NAILS = 'nails',
  EYEBROWS_LASHES = 'eyebrows_lashes',
  BEAUTY_SALON = 'beauty_salon',
  MEDSPA = 'medspa',
  BARBER = 'barber',
  MASSAGE = 'massage',
  SPA_SAUNA = 'spa_sauna',
  WAXING_SALON = 'waxing_salon',
  TATTOOING_PIERCING = 'tattooing_piercing',
  TANNING_STUDIO = 'tanning_studio',
  FITNESS_RECOVERY = 'fitness_recovery',
  PHYSICAL_THERAPY = 'physical_therapy',
  HEALTH_PRACTICE = 'health_practice',
  PET_GROOMING = 'pet_grooming',

  OTHER = 'other',
}

export enum BusinessType {
  PHYSICAL_PRODUCT = 'physical_product',
  SERVICE_PROVIDER = 'service_provider',
  HYBRID = 'hybrid',
}

export enum ServiceLocation {
  PHYSICAL_LOCATION = 'physical_location',
  MOBILE_OPERATOR = 'mobile_operator',
  VIRTUAL_ONLINE = 'virtual_online',
}

export enum TeamSize {
  INDEPENDENT = 'independent',
  TWO_TO_FIVE = '2-5',
  SIX_TO_TEN = '6-10',
  ELEVEN_TO_TWENTY = '11-20',
  TWENTY_PLUS = '20+',
}

export enum VendorStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  SUSPENDED = 'suspended',
  REJECTED = 'rejected',
}

export enum VendorType {
  MINI_MART = 'mini-mart',
  RESTAURANT = 'restaurant',
  SINGLE_CATEGORY = 'single-category',
}

@Schema({
  timestamps: true,
  toJSON: {
    transform: (doc: any, ret: any) => {
      if (ret.businessType === BusinessType.SERVICE_PROVIDER) {
        delete ret.deliveryFee;
        delete ret.baseDeliveryFee;
        delete ret.packagingFee;
        delete ret.packs;
        delete ret.minimumOrder;
      }
      return ret;
    },
  },
  toObject: {
    transform: (doc: any, ret: any) => {
      if (ret.businessType === BusinessType.SERVICE_PROVIDER) {
        delete ret.deliveryFee;
        delete ret.baseDeliveryFee;
        delete ret.packagingFee;
        delete ret.packs;
        delete ret.minimumOrder;
      }
      return ret;
    },
  },
})
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

  @Prop()
  brandColor: string;

  @Prop({ required: true })
  category: string;
  
  @Prop({ type: String, enum: VendorType, default: VendorType.RESTAURANT })
  vendorType: VendorType;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop()
  phone: string;

  @Prop()
  address: string;

  @Prop({ type: String, enum: BusinessType, default: BusinessType.PHYSICAL_PRODUCT })
  businessType: BusinessType;

  @Prop({ type: String, enum: ServiceLocation, required: false })
  serviceLocation: ServiceLocation;

  @Prop({ type: String, required: false })
  softwareUsed: string;

  @Prop({ type: String, enum: TeamSize, required: false })
  teamSize: TeamSize;

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

  @Prop({ type: String, required: false })
  fcmToken: string;

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
