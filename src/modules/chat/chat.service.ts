import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChatMessage } from './schemas/chat-message.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(ChatMessage.name) private chatModel: Model<ChatMessage>,
  ) {}

  async createMessage(data: {
    orderId: string;
    senderId: string;
    receiverId: string;
    message: string;
    messageType?: string;
    attachment?: string;
  }): Promise<ChatMessage> {
    return this.chatModel.create({
      order: new Types.ObjectId(data.orderId),
      sender: new Types.ObjectId(data.senderId),
      receiver: new Types.ObjectId(data.receiverId),
      message: data.message,
      messageType: data.messageType || 'text',
      attachment: data.attachment,
    });
  }

  async getOrderMessages(orderId: string): Promise<ChatMessage[]> {
    return this.chatModel
      .find({ order: new Types.ObjectId(orderId) })
      .populate('sender', 'firstName lastName avatar')
      .populate('receiver', 'firstName lastName avatar')
      .sort({ createdAt: 1 });
  }

  async markAsRead(messageId: string): Promise<void> {
    await this.chatModel.findByIdAndUpdate(messageId, {
      isRead: true,
      readAt: new Date(),
    });
  }

  async markAllAsRead(orderId: string, userId: string): Promise<void> {
    await this.chatModel.updateMany(
      {
        order: new Types.ObjectId(orderId),
        receiver: new Types.ObjectId(userId),
        isRead: false,
      },
      { isRead: true, readAt: new Date() },
    );
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.chatModel.countDocuments({
      receiver: new Types.ObjectId(userId),
      isRead: false,
    });
  }
}
