import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class ChatMessage extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Order' })
  order?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Appointment' })
  appointment?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ChatMessage' })
  replyTo?: Types.ObjectId;

  @Prop({ type: String, enum: ['order', 'support', 'direct'], default: 'order' })
  roomType: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sender: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  receiver: Types.ObjectId;

  @Prop({ required: true })
  message: string;

  @Prop({ default: 'text' })
  messageType: string; // text, image, location

  @Prop()
  attachment: string;

  @Prop({ default: false })
  isRead: boolean;

  @Prop()
  readAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);
ChatMessageSchema.index({ order: 1, createdAt: 1 });
ChatMessageSchema.index({ appointment: 1, createdAt: 1 });
ChatMessageSchema.index({ sender: 1 });
ChatMessageSchema.index({ receiver: 1 });
