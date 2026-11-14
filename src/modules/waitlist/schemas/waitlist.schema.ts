import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WaitlistFormDocument = WaitlistForm & Document;

/**
 * One form a service provider can publish and share.
 *
 * A vendor may run several at once — "Saturday slots" and "New colour service" are different
 * lists — so forms are a collection rather than a single settings field.
 */
@Schema({ timestamps: true })
export class WaitlistForm {
  _id?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Vendor', required: true, index: true })
  vendor: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ default: '' })
  description: string;

  /** URL-safe, unique per vendor: {subdomain}.erranders.org/waitlist/{slug} */
  @Prop({ required: true, index: true })
  slug: string;

  /**
   * Fields the customer fills in.
   *
   * Kept flexible on purpose — a barber wants name and preferred time, a tutor wants subject and
   * level. Stored as an ordered array so the builder controls the sequence.
   */
  @Prop({
    type: [
      {
        key: { type: String, required: true },
        label: { type: String, required: true },
        type: { type: String, enum: ['text', 'email', 'phone', 'textarea', 'select', 'date'], default: 'text' },
        required: { type: Boolean, default: false },
        options: { type: [String], default: [] },
      },
    ],
    default: [],
  })
  fields: Array<{
    key: string;
    label: string;
    type: string;
    required?: boolean;
    options?: string[];
  }>;

  @Prop({ default: false, index: true })
  isPublished: boolean;

  @Prop({ default: 0 })
  responseCount: number;
}

export const WaitlistFormSchema = SchemaFactory.createForClass(WaitlistForm);
WaitlistFormSchema.index({ vendor: 1, slug: 1 }, { unique: true });

/**
 * One submission. Separate collection because responses grow without bound while the form does not.
 */
@Schema({ timestamps: true })
export class WaitlistResponse {
  _id?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'WaitlistForm', required: true, index: true })
  form: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Vendor', required: true, index: true })
  vendor: Types.ObjectId;

  @Prop({ type: Object, default: {} })
  answers: Record<string, any>;

  @Prop({ default: 'new', enum: ['new', 'contacted', 'converted', 'declined'] })
  status: string;

  @Prop({ default: '' })
  note: string;
}

export const WaitlistResponseSchema = SchemaFactory.createForClass(WaitlistResponse);
