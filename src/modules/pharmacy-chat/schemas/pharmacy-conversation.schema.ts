import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PharmacyConversationDocument = PharmacyConversation & Document;

/**
 * One question, one pharmacist, one thread.
 *
 * "Is this safe with what I already take?" is a clinical question, so it goes to a human. The
 * thread is attached to the product and, once it exists, to the order — which is what lets the
 * pharmacist see the whole picture instead of answering in isolation.
 */
@Schema({ timestamps: true })
export class PharmacyConversation {
  _id?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  customer: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Vendor', required: true, index: true })
  vendor: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Product', default: null })
  product?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Order', default: null })
  order?: Types.ObjectId;

  @Prop({ type: String, default: 'Medication question' })
  subject: string;

  @Prop({
    type: [
      {
        sender: { type: String, enum: ['customer', 'pharmacist', 'bot'], required: true },
        senderName: { type: String, default: '' },
        body: { type: String, required: true },
        at: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  messages: Array<{ sender: 'customer' | 'pharmacist' | 'bot'; senderName?: string; body: string; at?: Date }>;

  @Prop({ type: String, enum: ['open', 'answered', 'closed'], default: 'open', index: true })
  status: 'open' | 'answered' | 'closed';

  @Prop({ type: Boolean, default: false })
  flaggedForReview: boolean;

  @Prop({ type: Date, default: null })
  lastMessageAt?: Date;
}

export const PharmacyConversationSchema = SchemaFactory.createForClass(PharmacyConversation);
PharmacyConversationSchema.index({ vendor: 1, status: 1, lastMessageAt: -1 });
