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
  handleJoinOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string },
  ) {
    client.join(`order:${data.orderId}`);
    return { event: 'joined', data: { orderId: data.orderId } };
  }

  @SubscribeMessage('leaveOrder')
  handleLeaveOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string },
  ) {
    client.leave(`order:${data.orderId}`);
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      orderId: string;
      senderId: string;
      receiverId: string;
      message: string;
      messageType?: string;
      attachment?: string;
    },
  ) {
    const savedMessage = await this.chatService.createMessage(data);
    const populated = await savedMessage.populate([
      { path: 'sender', select: 'firstName lastName avatar' },
    ]);

    // Emit to order room
    this.server
      .to(`order:${data.orderId}`)
      .emit('newMessage', populated);

    // Direct notification to receiver if connected
    const receiverSocketId = this.connectedUsers.get(data.receiverId);
    if (receiverSocketId) {
      this.server.to(receiverSocketId).emit('notification', {
        type: 'new_message',
        orderId: data.orderId,
        message: data.message,
        senderId: data.senderId,
      });
    }

    return populated;
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string; userId: string },
  ) {
    client.to(`order:${data.orderId}`).emit('userTyping', {
      userId: data.userId,
      orderId: data.orderId,
      isTyping: true,
    });
  }

  @SubscribeMessage('stopTyping')
  handleStopTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string; userId: string },
  ) {
    client.to(`order:${data.orderId}`).emit('userTyping', {
      userId: data.userId,
      orderId: data.orderId,
      isTyping: false,
    });
  }

  @SubscribeMessage('markRead')
  async handleMarkRead(
    @MessageBody() data: { orderId: string; userId: string },
  ) {
    await this.chatService.markAllAsRead(data.orderId, data.userId);
    this.server.to(`order:${data.orderId}`).emit('messagesRead', {
      orderId: data.orderId,
      userId: data.userId,
    });
  }
}
