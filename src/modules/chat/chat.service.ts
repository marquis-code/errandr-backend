import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChatMessage } from './schemas/chat-message.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(ChatMessage.name) private chatModel: Model<ChatMessage>,
  ) {}

  private readonly botAnswers = [
    { keywords: ['track', 'where', 'location'], answer: "You can track your order in real-time from the 'My Orders' section on your dashboard. You'll see the errander's live location once they pick up your items!" },
    { keywords: ['late', 'delayed', 'slow'], answer: "Don't worry! Errandr is committed to speed. If your delivery exceeds our promised time window, please contact our support team here for a potential delivery fee refund." },
    { keywords: ['become', 'rider', 'errander', 'join'], answer: "You can apply to be an errander by visiting the 'Become a Rider' section on our homepage. You'll need a valid student ID and a bicycle or scooter." },
    { keywords: ['payment', 'failed', 'paystack', 'money'], answer: "For payment-related issues, please ensure you have a stable network. If your account was debited but the order didn't go through, share your Paystack Reference ID here." },
    { keywords: ['refund', 'cancelled', 'withdraw'], answer: "Refunds are processed automatically to your Errandr Wallet within 24 hours of cancellation. You can withdraw to your bank account anytime via the Wallet section." },
    { keywords: ['help', 'hello', 'hi'], answer: "Hi! I'm the Errandr Assistant. 🚀 I can help with tracking, refunds, and general questions. How can I help you today?" }
  ];

  async createMessage(data: {
    orderId?: string;
    senderId: string;
    receiverId?: string;
    message: string;
    messageType?: string;
    roomType?: string;
    attachment?: string;
  }): Promise<ChatMessage> {
    const msg = await this.chatModel.create({
      order: data.orderId ? new Types.ObjectId(data.orderId) : undefined,
      sender: new Types.ObjectId(data.senderId),
      receiver: data.receiverId ? new Types.ObjectId(data.receiverId) : undefined,
      message: data.message,
      messageType: data.messageType || 'text',
      roomType: data.roomType || (data.orderId ? 'order' : 'support'),
      attachment: data.attachment,
    });

    return msg;
  }

  async getBotResponse(message: string): Promise<string | null> {
    const normalized = message.toLowerCase();
    const match = this.botAnswers.find(a => 
      a.keywords.some(k => normalized.includes(k))
    );
    return match ? match.answer : null;
  }

  async getOrderMessages(orderId: string): Promise<ChatMessage[]> {
    return this.chatModel
      .find({ order: new Types.ObjectId(orderId) })
      .populate('sender', 'firstName lastName avatar')
      .populate('receiver', 'firstName lastName avatar')
      .sort({ createdAt: 1 });
  }

  async getSupportMessages(userId: string): Promise<ChatMessage[]> {
    return this.chatModel
      .find({
        roomType: 'support',
        $or: [
          { sender: new Types.ObjectId(userId) },
          { receiver: new Types.ObjectId(userId) }
        ]
      })
      .populate('sender', 'firstName lastName avatar role')
      .populate('receiver', 'firstName lastName avatar role')
      .sort({ createdAt: 1 });
  }

  async getSupportThreads(): Promise<any[]> {
    const messages = await this.chatModel
      .find({ roomType: 'support' })
      .populate('sender', 'firstName lastName avatar email role')
      .populate('receiver', 'firstName lastName avatar email role')
      .sort({ createdAt: -1 });

    const threads = new Map<string, any>();

    for (const msg of messages) {
      // Find the non-admin/SYSTEM user in this message
      const sender: any = msg.sender || {};
      const receiver: any = msg.receiver || {};

      let studentUser: any = null;
      if (sender.role === 'student' || sender.role === 'customer' || !['admin', 'bot', undefined].includes(sender.role)) {
         studentUser = sender;
      } else if (receiver.role === 'student' || receiver.role === 'customer' || !['admin', 'bot', undefined].includes(receiver.role)) {
         studentUser = receiver;
      }

      // If we couldn't clearly identify the student based on role, fallback to sender if it's not SYSTEM
      if (!studentUser) {
         if (sender._id && sender._id.toString() !== 'SYSTEM_BOT' && sender.role !== 'admin') {
            studentUser = sender;
         } else if (receiver._id && receiver._id.toString() !== 'SYSTEM_BOT' && receiver.role !== 'admin') {
            studentUser = receiver;
         } else {
             studentUser = sender; // default
         }
      }
      
      const userIdStr = studentUser?._id?.toString();
      if (!userIdStr || userIdStr === 'SYSTEM_BOT') continue;

      if (!threads.has(userIdStr)) {
        threads.set(userIdStr, {
          userId: userIdStr,
          userData: studentUser,
          lastMessage: msg.message,
          lastMessageAt: (msg as any).createdAt,
          unreadCount: 0, 
        });
      }
      
      if (!msg.isRead && receiver.role === 'admin') {
          threads.get(userIdStr).unreadCount += 1;
      }
    }

    return Array.from(threads.values());
  }

  async markAsRead(messageId: string): Promise<void> {
    await this.chatModel.findByIdAndUpdate(messageId, {
      isRead: true,
      readAt: new Date(),
    });
  }

  async markAllAsRead(orderId: string, userId: string): Promise<void> {
    const filter: any = {
      receiver: new Types.ObjectId(userId),
      isRead: false,
    };
    if (orderId) filter.order = new Types.ObjectId(orderId);
    
    await this.chatModel.updateMany(filter, { isRead: true, readAt: new Date() });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.chatModel.countDocuments({
      receiver: new Types.ObjectId(userId),
      isRead: false,
    });
  }
}
