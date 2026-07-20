import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChatMessage } from './schemas/chat-message.schema';
import { Order } from '../orders/schemas/order.schema';
import { Appointment } from '../appointments/schemas/appointment.schema';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(ChatMessage.name) private chatModel: Model<ChatMessage>,
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(Appointment.name) private appointmentModel: Model<Appointment>,
    @Inject(forwardRef(() => NotificationsService)) private notificationsService: NotificationsService,
  ) {}

  private readonly botAnswers = [
    { keywords: ['track', 'where', 'location'], answer: "You can track your order in real-time from the 'My Orders' section on your dashboard. You'll see the errander's live location once they pick up your items!" },
    { keywords: ['late', 'delayed', 'slow'], answer: "Don't worry! Erranders is committed to speed. If your delivery exceeds our promised time window, please contact our support team here for a potential delivery fee refund." },
    { keywords: ['become', 'rider', 'errander', 'join'], answer: "You can apply to be an errander by visiting the 'Become a Rider' section on our homepage. You'll need a valid student ID and a bicycle or scooter." },
    { keywords: ['payment', 'failed', 'paystack', 'money'], answer: "For payment-related issues, please ensure you have a stable network. If your account was debited but the order didn't go through, share your Paystack Reference ID here." },
    { keywords: ['refund', 'cancelled', 'withdraw'], answer: "Refunds are processed automatically to your Erranders Wallet within 24 hours of cancellation. You can withdraw to your bank account anytime via the Wallet section." },
    { keywords: ['help', 'hello', 'hi'], answer: "Hi! I'm the Erranders Assistant. 🚀 I can help with tracking, refunds, and general questions. How can I help you today?" }
  ];

  async createMessage(data: {
    orderId?: string;
    appointmentId?: string;
    senderId: string;
    receiverId?: string;
    message: string;
    messageType?: string;
    roomType?: string;
    attachment?: string;
    replyTo?: string;
  }): Promise<ChatMessage> {
    const msg = await this.chatModel.create({
      order: data.orderId ? new Types.ObjectId(data.orderId) : undefined,
      appointment: data.appointmentId ? new Types.ObjectId(data.appointmentId) : undefined,
      sender: new Types.ObjectId(data.senderId),
      receiver: data.receiverId ? new Types.ObjectId(data.receiverId) : undefined,
      message: data.message,
      messageType: data.messageType || 'text',
      roomType: data.roomType || (data.orderId ? 'order' : (data.appointmentId ? 'direct' : 'support')),
      attachment: data.attachment,
      replyTo: data.replyTo ? new Types.ObjectId(data.replyTo) : undefined,
    });

    // Fire-and-forget: send push notifications in background WITHOUT blocking the return.
    // This is critical - previously this was awaited which caused 4+ second delays before
    // the WebSocket emit could happen in the gateway.
    this.sendChatPushNotifications(msg, data).catch(err => 
      console.error('Background push notification error:', err)
    );

    return msg;
  }

  /**
   * Background push notification sender - extracted from createMessage so it doesn't
   * block the WebSocket emit in the gateway. Runs fire-and-forget.
   */
  private async sendChatPushNotifications(msg: any, data: any): Promise<void> {
    if (msg.roomType === 'order' && data.orderId) {
      const order = await this.orderModel.findById(data.orderId)
        .populate('customer')
        .populate('vendor')
        .populate('errander');

      if (order) {
        const senderStr = data.senderId.toString();
        const customer: any = order.customer;
        const vendor: any = order.vendor;
        const errander: any = order.errander;
        
        const customerId = customer?._id?.toString() || customer?.toString();
        const vendorOwnerId = vendor?.owner?.toString() || vendor?._id?.toString() || vendor?.toString();
        const erranderId = errander?._id?.toString() || errander?.toString();
        
        const senderObj = await this.chatModel.findById(msg._id).populate('sender', 'firstName lastName');
        const senderName = senderObj?.sender ? `${(senderObj.sender as any).firstName || ''} ${(senderObj.sender as any).lastName || ''}`.trim() : 'User';

        let recipients: string[] = [];
        if (data.receiverId) {
          recipients = [data.receiverId.toString()];
        } else {
          recipients = [customerId, vendorOwnerId, erranderId].filter(id => id && id !== senderStr);
        }
        const uniqueRecipients = [...new Set(recipients)];

        for (const r of uniqueRecipients) {
          await this.notificationsService.sendNotification(r, {
            title: `New message from ${senderName}`,
            body: data.messageType === 'image' ? '📸 Sent an image' : (data.messageType === 'voice' ? '🎤 Sent a voice message' : (data.message.length > 50 ? data.message.substring(0, 50) + '...' : data.message)),
            type: 'NEW_CHAT_MESSAGE',
            data: { orderId: data.orderId, orderNumber: order.orderNumber, messageId: msg._id }
          }).catch(err => console.error(`Failed to send chat notification to ${r}`, err));
        }
      }
    } else if (msg.roomType === 'direct' && data.appointmentId) {
      const appointment = await this.appointmentModel.findById(data.appointmentId)
        .populate('user')
        .populate('vendor');

      if (appointment) {
        const senderStr = data.senderId.toString();
        const customer: any = appointment.user;
        const vendor: any = appointment.vendor;
        
        const customerId = customer?._id?.toString() || customer?.toString();
        const vendorOwnerId = vendor?.owner?.toString();
        
        const senderObj = await this.chatModel.findById(msg._id).populate('sender', 'firstName lastName');
        const senderName = senderObj?.sender ? `${(senderObj.sender as any).firstName || ''} ${(senderObj.sender as any).lastName || ''}`.trim() : 'User';

        const recipients = [customerId, vendorOwnerId].filter(id => id && id !== senderStr);
        const uniqueRecipients = [...new Set(recipients)];

        for (const r of uniqueRecipients) {
          await this.notificationsService.sendNotification(r, {
            title: `New message from ${senderName}`,
            body: data.messageType === 'image' ? '📸 Sent an image' : (data.messageType === 'voice' ? '🎤 Sent a voice message' : (data.message.length > 50 ? data.message.substring(0, 50) + '...' : data.message)),
            type: 'NEW_CHAT_MESSAGE',
            data: { appointmentId: data.appointmentId, messageId: msg._id }
          }).catch(err => console.error(`Failed to send chat notification to ${r}`, err));
        }
      }
    }
  }

  async getBotResponse(message: string): Promise<string | null> {
    const normalized = message.toLowerCase();
    const match = this.botAnswers.find(a => 
      a.keywords.some(k => normalized.includes(k))
    );
    return match ? match.answer : null;
  }

  async getOrderParticipants(orderId: string): Promise<any> {
    return this.orderModel.findById(orderId)
      .populate('customer', '_id')
      .populate('vendor', '_id owner')
      .populate('errander', '_id');
  }

  async getAppointmentParticipants(appointmentId: string): Promise<any> {
    return this.appointmentModel.findById(appointmentId)
      .populate('user', '_id')
      .populate('vendor', '_id owner');
  }

  async getOrderMessages(orderId: string): Promise<ChatMessage[]> {
    return this.chatModel
      .find({ order: new Types.ObjectId(orderId) })
      .populate('sender', 'firstName lastName avatar')
      .populate('receiver', 'firstName lastName avatar')
      .sort({ createdAt: 1 });
  }

  async getAppointmentMessages(appointmentId: string): Promise<ChatMessage[]> {
    return this.chatModel
      .find({ appointment: new Types.ObjectId(appointmentId) })
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

  async getDirectMessages(userId: string, vendorOwnerId: string): Promise<ChatMessage[]> {
    return this.chatModel
      .find({
        roomType: 'direct',
        appointment: { $exists: false },
        $or: [
          { sender: new Types.ObjectId(userId), receiver: new Types.ObjectId(vendorOwnerId) },
          { sender: new Types.ObjectId(vendorOwnerId), receiver: new Types.ObjectId(userId) }
        ]
      })
      .populate('sender', 'firstName lastName avatar role')
      .populate('receiver', 'firstName lastName avatar role')
      .sort({ createdAt: 1 });
  }

  async getDirectConversations(userId: string): Promise<any[]> {
    const messages = await this.chatModel
      .find({
        roomType: 'direct',
        appointment: { $exists: false },
        $or: [
          { sender: new Types.ObjectId(userId) },
          { receiver: new Types.ObjectId(userId) }
        ]
      })
      .populate('sender', 'firstName lastName avatar storeName')
      .populate('receiver', 'firstName lastName avatar storeName')
      .sort({ createdAt: -1 });

    const threads = new Map<string, any>();

    for (const msg of messages) {
      const sender: any = msg.sender || {};
      const receiver: any = msg.receiver || {};

      // The other user is the one that is NOT the current userId
      const otherUser = sender._id?.toString() === userId ? receiver : sender;
      if (!otherUser._id) continue;

      const otherUserId = otherUser._id.toString();

      if (!threads.has(otherUserId)) {
        threads.set(otherUserId, {
          user: otherUser,
          lastMessage: msg,
          unreadCount: 0 // Will populate this later if needed
        });
      }

      if (msg.receiver?.toString() === userId && !msg.isRead) {
        threads.get(otherUserId).unreadCount++;
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

  async getUnreadCountPerOrder(userId: string): Promise<Record<string, number>> {
    const counts = await this.chatModel.aggregate([
      { 
        $match: { 
          receiver: new Types.ObjectId(userId), 
          isRead: false, 
          order: { $exists: true } 
        } 
      },
      { 
        $group: { 
          _id: '$order', 
          count: { $sum: 1 } 
        } 
      }
    ]);
    const result: Record<string, number> = {};
    counts.forEach(c => { 
      if (c._id) result[c._id.toString()] = c.count; 
    });
    return result;
  }
}
