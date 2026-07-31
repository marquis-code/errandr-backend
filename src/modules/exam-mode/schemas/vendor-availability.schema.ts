import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class VendorAvailability extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Vendor', required: true, unique: true })
  vendorId: Types.ObjectId;

  @Prop({
    type: [{
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      reason: String
    }],
    default: []
  })
  unavailableRanges: { startDate: Date; endDate: Date; reason?: string }[];

  @Prop({
    type: [{
      dayOfWeek: { type: Number, min: 0, max: 6, required: true }, // 0 = Sunday, 6 = Saturday
      startTime: { type: String, required: true }, // format "HH:mm"
      endTime: { type: String, required: true }
    }],
    default: []
  })
  replyWindows: { dayOfWeek: number; startTime: string; endTime: string }[];

  @Prop()
  autoReplyMessage: string;

  @Prop({ default: false })
  isExamModeActive: boolean;
}

export const VendorAvailabilitySchema = SchemaFactory.createForClass(VendorAvailability);
