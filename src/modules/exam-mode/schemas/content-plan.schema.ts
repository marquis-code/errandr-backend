import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum ContentPlanStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  POSTED = 'posted',
  FAILED = 'failed'
}

export enum ContentPostTarget {
  WHATSAPP_STATUS = 'whatsapp_status',
  INSTAGRAM = 'instagram',
  INTERNAL_ONLY = 'internal_only'
}

@Schema({ timestamps: true })
export class ContentPlan extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Vendor', required: true })
  vendorId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Product' })
  itemId: Types.ObjectId; // Optional

  @Prop({ required: true })
  imageUrl: string;

  @Prop()
  caption: string;

  @Prop({ required: true })
  scheduledDate: Date;

  @Prop({ type: String, enum: ContentPlanStatus, default: ContentPlanStatus.DRAFT })
  status: ContentPlanStatus;

  @Prop({ type: String, enum: ContentPostTarget, default: ContentPostTarget.WHATSAPP_STATUS })
  postTarget: ContentPostTarget;
}

export const ContentPlanSchema = SchemaFactory.createForClass(ContentPlan);
