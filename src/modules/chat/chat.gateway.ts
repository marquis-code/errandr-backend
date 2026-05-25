import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { RedisService } from '../redis/redis.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<string, string>(); // userId -> socketId

  constructor(
    private chatService: ChatService,
    private redisService: RedisService,
  ) {}

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      this.connectedUsers.set(userId, client.id);
      this.redisService.hset('online:users', userId, client.id);
      console.log(`User ${userId} connected to chat`);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = [...this.connectedUsers.entries()].find(
      ([, socketId]) => socketId === client.id,
    )?.[0];
    if (userId) {
      this.connectedUsers.delete(userId);
      this.redisService.hdel('online:users', userId);
      console.log(`User ${userId} disconnected from chat`);
    }
  }

  @SubscribeMessage('joinOrder')
  @SubscribeMessage('chat:join-room')
  handleJoinOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId?: string; roomId?: string; userId?: string },
  ) {
    const id = data.roomId || data.orderId || data.userId;
    if (data.orderId || (data.roomId && !data.userId)) {
      client.join(`order:${id}`);
    } else {
      client.join(`support:${id}`);
      client.join('admin:support');
    }
    return { success: true, event: 'joined', data: { id } };
  }

  @SubscribeMessage('joinSupport')
  handleJoinSupport(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    client.join(`support:${data.userId}`);
    client.join('admin:support');
    return { success: true, event: 'joined_support', data: { userId: data.userId } };
  }

  @SubscribeMessage('sendMessage')
  @SubscribeMessage('chat:send-message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      orderId?: string;
      roomId?: string; // Standardized
      senderId: string;
      receiverId?: string;
      message?: string; // Backend was using 'message'
      content?: string; // Frontend is using 'content'
      messageType?: string;
      roomType?: string;
      attachment?: string;
    },
  ) {
    const messageContent = data.content || data.message || '';
    const orderId = data.orderId || (data.roomType === 'order' ? data.roomId : undefined);
    const roomType = data.roomType || (orderId ? 'order' : 'support');
    
    try {
      const savedMessage = await this.chatService.createMessage({ 
        ...data, 
        message: messageContent,
        orderId,
        roomType 
      });
      
      const populated = await savedMessage.populate([
        { path: 'sender', select: 'firstName lastName avatar role' },
      ]);

      // Format for frontend (which expects 'content')
      const msgObj = populated.toObject();
      const formattedMessage = {
        ...msgObj,
        // Explicitly include flat IDs for frontend compatibility
        orderId: orderId || String(msgObj.order || ''),
        senderId: data.senderId || String(msgObj.sender?._id || msgObj.sender || ''),
        receiverId: data.receiverId || String(msgObj.receiver?._id || msgObj.receiver || ''),
        message: messageContent,
        content: messageContent,
        senderType: populated.sender?.['role'] === 'admin' ? 'support' : 'customer'
      };

    // Determine target room
    const targetRoom = roomType === 'order' 
      ? `order:${orderId}` 
      : `support:${data.senderId}`;

    // Emit to rooms
    if (roomType === 'support') {
      this.server.to('admin:support').emit('chat:new-message', formattedMessage);
      this.server.to(`support:${data.senderId}`).emit('chat:new-message', formattedMessage);
      
      // TRIGGER BOT logic
      const botResponse = await this.chatService.getBotResponse(messageContent);
      if (botResponse && (!data.receiverId || data.receiverId === 'SYSTEM')) {
        setTimeout(async () => {
          const botMsg = await this.chatService.createMessage({
            senderId: 'SYSTEM_BOT',
            receiverId: data.senderId,
            message: botResponse,
            roomType: 'support'
          });
          const botPopulated = await botMsg.populate([
            { path: 'sender', select: 'firstName lastName avatar role' },
          ]);
          const formattedBot = {
            ...botPopulated.toObject(),
            content: botResponse,
            senderType: 'bot',
            senderName: 'Erranders Bot'
          };
          this.server.to(`support:${data.senderId}`).emit('chat:new-message', formattedBot);
        }, 1000);
      }
    } else {
      const targetRoom = `order:${orderId}`;
      this.server.to(targetRoom).emit('chat:new-message', formattedMessage);
      this.server.to(targetRoom).emit('newMessage', formattedMessage); // compatibility
    }

    // Emit newMessageNotification to all connected order participants (not just receiverId)
    // This ensures the vendor, customer, and errander all get real-time notifications
    const notifyTargets: string[] = [];
    if (data.receiverId) notifyTargets.push(data.receiverId);
    
    // Also look up all order participants to notify
    if (orderId) {
      try {
        const order = await this.chatService.getOrderParticipants(orderId);
        if (order) {
          const participants = [
            order.customer?._id?.toString() || order.customer?.toString(),
            order.vendor?.owner?.toString() || order.vendor?._id?.toString() || order.vendor?.toString(),
            order.errander?._id?.toString() || order.errander?.toString(),
          ].filter(Boolean);
          for (const p of participants) {
            if (p && p !== data.senderId && !notifyTargets.includes(p)) {
              notifyTargets.push(p);
            }
          }
        }
      } catch (e) {
        console.error('Failed to get order participants for notification', e);
      }
    }

    // Also emit a global notification to the specific receiver if they are connected
    for (const targetId of notifyTargets) {
      const socketId = this.connectedUsers.get(targetId);
      if (socketId) {
        this.server.to(socketId).emit('newMessageNotification', formattedMessage);
      }
    }

    console.log(`[ChatGateway] Broadcasted message ${formattedMessage._id} from ${data.senderId} to room ${targetRoom}. notifyTargets:`, notifyTargets);

    return { success: true, message: formattedMessage };
    } catch (error) {
      console.error('Failed to handle chat message:', error);
      return { success: false, error: error.message || 'Internal server error' };
    }
  }

  @SubscribeMessage('typing')
  @SubscribeMessage('chat:typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId?: string; roomId?: string; userId?: string; roomType?: string; isTyping: boolean },
  ) {
    const id = data.roomId || data.orderId || data.userId;
    const room = (data.roomType === 'support' || data.userId) ? `support:${id}` : `order:${id}`;
    client.to(room).emit('chat:user-typing', {
      userId: data.userId,
      isTyping: data.isTyping,
      roomId: id
    });
  }

  @SubscribeMessage('markRead')
  @SubscribeMessage('chat:mark-read')
  async handleMarkRead(
    @MessageBody() data: { orderId?: string; roomId?: string; userId: string; roomType?: string },
  ) {
    const id = data.roomId || data.orderId || '';
    await this.chatService.markAllAsRead(id, data.userId);
    const room = (data.roomType === 'support' || !data.orderId) ? `support:${data.userId}` : `order:${id}`;
    this.server.to(room).emit('messagesRead', {
      userId: data.userId,
    });
  }
}
