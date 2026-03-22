import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class ChatMessage extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Order', required: true })
  order: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sender: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
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
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);
ChatMessageSchema.index({ order: 1, createdAt: 1 });
ChatMessageSchema.index({ sender: 1 });
ChatMessageSchema.index({ receiver: 1 });
