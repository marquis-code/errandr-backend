import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * The app surfaces a campus can power. A campus may enable only a subset,
 * e.g. a campus with no rider fleet only supports ['student', 'vendor'].
 */
export const SUPPORTED_APP_TYPES = ['student', 'vendor', 'dispatch'] as const;
export type SupportedAppType = (typeof SUPPORTED_APP_TYPES)[number];

@Schema({
  timestamps: true,
  toJSON: {
    transform: (doc: any, ret: any) => {
      delete ret.__v;
      return ret;
    },
  },
  toObject: {
    transform: (doc: any, ret: any) => {
      delete ret.__v;
      return ret;
    },
  },
})
export class Institution extends Document {
  // Full legal-ish name, e.g. "College of Medicine, University of Lagos"
  @Prop({ required: true, trim: true })
  name: string;

  // Shown in chips and the drawer, e.g. "CMUL"
  @Prop({ required: true, trim: true })
  shortName: string;

  // Unique, lowercase, URL-safe. The stable public key for this campus.
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  slug: string;

  @Prop({ required: true, trim: true })
  city: string;

  @Prop({ required: true, trim: true })
  state: string;

  @Prop({ required: true, trim: true, default: 'Nigeria' })
  country: string;

  @Prop({ trim: true })
  category?: string;

  // Campus centre as a GeoJSON Point: { type: 'Point', coordinates: [lng, lat] }
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
  center: {
    type: string;
    coordinates: number[];
  };

  @Prop({ default: 8 })
  deliveryRadiusKm: number;

  // Inactive campuses are hidden from the picker.
  @Prop({ default: true })
  isActive: boolean;

  // Lets a campus theme itself later.
  @Prop({
    type: {
      primaryColor: { type: String, default: '#FF5C1A' },
      tagline: { type: String },
      logoUrl: { type: String },
    },
    default: { primaryColor: '#FF5C1A' },
  })
  branding: {
    primaryColor: string;
    tagline?: string;
    logoUrl?: string;
  };

  @Prop({ type: [String], enum: SUPPORTED_APP_TYPES, default: [...SUPPORTED_APP_TYPES] })
  supportedAppTypes: string[];

  @Prop()
  contactPhone: string;

  @Prop()
  contactEmail: string;
}

export const InstitutionSchema = SchemaFactory.createForClass(Institution);
InstitutionSchema.index({ name: 'text' });
InstitutionSchema.index({ center: '2dsphere' });
