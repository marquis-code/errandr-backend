import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnModuleInit, Logger, Inject, forwardRef } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { RedisService } from '../redis/redis.service';
import { ChatService } from '../chat/chat.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/realtime',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private userSockets = new Map<string, Set<string>>();

  constructor(
    private notificationsService: NotificationsService,
    private redisService: RedisService,
    @Inject(forwardRef(() => ChatService))
    private chatService: ChatService,
  ) {}

  async onModuleInit() {
    this.initRedisSubscription().catch((error) => {
      this.logger.warn('NotificationsGateway: Redis subscription unavailable — real-time notifications will use WebSocket only', error?.message);
    });
  }

  private async initRedisSubscription() {
    const subClient = this.redisService.getNewClient();

    subClient.on('connect', () => this.logger.log('Redis Subscriber: Connected'));
    subClient.on('ready', () => this.logger.log('Redis Subscriber: Ready to receive messages'));
    subClient.on('error', (err) => {
      if (!this['_redisErrorLogged']) {
        this.logger.warn('Redis Subscriber: Connection error (suppressing further logs):', err.message);
        this['_redisErrorLogged'] = true;
      }
    });
    subClient.on('reconnecting', () => {
      this.logger.warn('Redis Subscriber: Reconnecting...');
    });

    const subscribeTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Redis subscribe timed out after 5s')), 5000)
    );

    try {
      await Promise.race([
        subClient.psubscribe('notification:*'),
        subscribeTimeout,
      ]);
    } catch (err) {
      this.logger.warn(`Redis psubscribe failed: ${err.message} — continuing without Redis pub/sub`);
      try { subClient.disconnect(); } catch (_) {}
      return;
    }

    subClient.on('pmessage', (pattern, channel, message) => {
      const target = channel.split(':').slice(1).join(':');
      if (!target) return;

      try {
        const notification = JSON.parse(message);

        if (target === 'broadcast:erranders') {
          if (notification.type === 'ORDER_ACCEPTED') {
            this.server.emit('notification:order-accepted', notification);
            this.logger.log(`[Redis Broadcast] notification:order-accepted sent to all clients`);
          } else if (notification.type === 'INTERCEPTION_REQUESTED' || notification.type === 'INTERCEPTION_ACCEPTED') {
            this.server.emit('notification:new', notification);
            this.logger.log(`[Redis Broadcast] notification:new (${notification.type}) sent to all clients`);
          } else {
            this.server.emit('notification:new-order', notification);
            this.logger.log(`[Redis Broadcast] notification:new-order sent to all clients`);
          }
        } else {
          this.server.to(`user:${target}`).emit('notification:new', notification);
          this.logger.log(`[Redis Directed] Sent notification to user:${target}`);
        }
      } catch (e) {
        this.logger.error('Failed to parse redis notification payload', e);
      }
    });

    this.logger.log('NotificationsGateway: Initialized on /realtime');
  }

  // ═══════════════════════════════════════════════════════════════════
  // CONNECTION LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════

  handleConnection(client: Socket) {
    const userId =
      client.handshake.query.userId as string ||
      client.handshake.auth?.userId as string;

    if (userId) {
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);
      client.join(`user:${userId}`);
      this.logger.log(`User ${userId} connected (socket: ${client.id})`);
    }
  }

  handleDisconnect(client: Socket) {
    for (const [userId, sockets] of this.userSockets.entries()) {
      if (sockets.has(client.id)) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
        }
        this.logger.log(`User ${userId} disconnected (socket: ${client.id})`);
        break;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // NOTIFICATION HANDLERS
  // ═══════════════════════════════════════════════════════════════════

  @SubscribeMessage('register')
  handleRegister(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    const { userId } = data;
    if (userId) {
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);
      client.join(`user:${userId}`);
      this.logger.log(`User ${userId} registered via event (socket: ${client.id})`);
      return { success: true };
    }
    return { success: false };
  }

  @SubscribeMessage('getNotifications')
  async handleGetNotifications(@ConnectedSocket() client: Socket) {
    const userId =
      client.handshake.query.userId as string ||
      client.handshake.auth?.userId as string;
    if (!userId) return [];
    return this.notificationsService.getNotifications(userId);
  }

  @SubscribeMessage('markRead')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { notificationId: string },
  ) {
    const userId =
      client.handshake.query.userId as string ||
      client.handshake.auth?.userId as string;
    if (!userId) return { success: false };
    await this.notificationsService.markAsRead(userId, data.notificationId);
    return { success: true };
  }

  @SubscribeMessage('viewing_errand')
  handleViewingErrand(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string, isViewing: boolean },
  ) {
    const userId =
      client.handshake.query.userId as string ||
      client.handshake.auth?.userId as string;
    
    if (userId && data.orderId) {
      const roomName = `order:${data.orderId}:viewers`;
      if (data.isViewing) {
        client.join(roomName);
      } else {
        client.leave(roomName);
      }
      
      const room = (client as any).adapter?.rooms?.get(roomName);
      const viewersCount = room?.size || 0;
      
      this.server.emit('errand:viewers_update', {
        orderId: data.orderId,
        viewersCount
      });
      
      this.logger.log(`User ${userId} is ${data.isViewing ? 'viewing' : 'no longer viewing'} order ${data.orderId}. Total viewers: ${viewersCount}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // CHAT SUPPORT — handles chat events on the /realtime namespace
  // Both student and admin frontends connect here, NOT to /chat
  // ═══════════════════════════════════════════════════════════════════

  @SubscribeMessage('joinSupport')
  handleJoinSupport(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    client.join(`support:${data.userId}`);
    client.join('admin:support');
    this.logger.log(`[Chat] Client joined support:${data.userId} and admin:support (socket: ${client.id})`);
    return { success: true, event: 'joined_support', data: { userId: data.userId } };
  }

  @SubscribeMessage('joinOrder')
  @SubscribeMessage('joinAppointment')
  @SubscribeMessage('chat:join-room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId?: string; appointmentId?: string; roomId?: string; userId?: string; roomType?: string; pairKey?: string },
  ) {
    const id = data.roomId || data.appointmentId || data.orderId || data.userId;
    if (data.orderId || (data.roomId && data.roomType === 'order')) {
      const orderRoom = data.pairKey ? `order:${id}:${data.pairKey}` : `order:${id}`;
      client.join(orderRoom);
      this.logger.log(`[Chat] Client joined room: ${orderRoom}`);
    } else if (data.appointmentId || (data.roomId && data.roomType === 'direct' && !data.roomId.includes('_'))) {
      client.join(`appointment:${id}`);
    } else if (data.roomType === 'direct') {
      client.join(`direct:${id}`);
    } else {
      client.join(`support:${id}`);
      client.join('admin:support');
    }
    return { success: true, event: 'joined', data: { id } };
  }

  @SubscribeMessage('sendMessage')
  @SubscribeMessage('chat:send-message')
  async handleChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      orderId?: string;
      appointmentId?: string;
      roomId?: string;
      senderId: string;
      receiverId?: string;
      message?: string;
      content?: string;
      messageType?: string;
      roomType?: string;
      attachment?: string;
      replyTo?: string;
      serviceId?: string;
      senderName?: string;
    },
  ) {
    const messageContent = data.content || data.message || '';
    const orderId = data.orderId || (data.roomType === 'order' ? data.roomId : undefined);
    let appointmentId = data.appointmentId;
    if (data.roomType === 'direct' && data.roomId && !data.roomId.includes('_')) {
      appointmentId = data.roomId;
    }
    const roomType = data.roomType || (orderId ? 'order' : (appointmentId ? 'direct' : 'support'));

    try {
      const tempId = new Date().getTime().toString() + Math.random().toString(36).substr(2, 9);

      // Determine target room
      let targetRoom = `support:${data.senderId}`;
      if (roomType === 'order' && data.receiverId) {
        const ids = [data.senderId, data.receiverId].sort();
        const pairKey = `${ids[0]}_${ids[1]}`;
        targetRoom = `order:${orderId}:${pairKey}`;
      } else if (roomType === 'order') {
        targetRoom = `order:${orderId}`;
      }
      if (roomType === 'direct') {
        targetRoom = appointmentId ? `appointment:${appointmentId}` : `direct:${data.roomId || `${Math.min(data.senderId as any, data.receiverId as any)}_${Math.max(data.senderId as any, data.receiverId as any)}`}`;
      }

      // Build optimistic message for IMMEDIATE emit
      const optimisticMessage = {
        _id: tempId,
        orderId: orderId || '',
        appointmentId: appointmentId || '',
        senderId: data.senderId,
        receiverId: data.receiverId || '',
        message: messageContent,
        content: messageContent,
        messageType: data.messageType || 'text',
        roomType,
        attachment: data.attachment,
        sender: { _id: data.senderId },
        receiver: data.receiverId ? { _id: data.receiverId } : undefined,
        order: orderId,
        appointment: appointmentId,
        service: data.serviceId,
        createdAt: new Date().toISOString(),
        senderType: 'customer',
        senderName: data.senderName,
      };

      // *** EMIT IMMEDIATELY — zero-latency broadcast ***
      if (roomType === 'support') {
        this.server.to('admin:support').emit('chat:new-message', optimisticMessage);
        this.server.to(`support:${data.senderId}`).emit('chat:new-message', optimisticMessage);
        if (data.receiverId) {
          this.server.to(`support:${data.receiverId}`).emit('chat:new-message', optimisticMessage);
        }
      } else {
        this.server.to(targetRoom).emit('chat:new-message', optimisticMessage);
        this.server.to(targetRoom).emit('newMessage', optimisticMessage);
      }

      // Also emit directly to receiverId's socket if connected
      if (data.receiverId) {
        const receiverSockets = this.userSockets.get(data.receiverId);
        if (receiverSockets) {
          for (const sid of receiverSockets) {
            this.server.to(sid).emit('newMessage', optimisticMessage);
            this.server.to(sid).emit('newMessageNotification', optimisticMessage);
          }
        }
      }

      this.logger.log(`[Chat] INSTANT broadcast tempId=${tempId} from ${data.senderId} to room ${targetRoom}`);

      // NOW save to DB
      const savedMessage = await this.chatService.createMessage({
        ...data,
        message: messageContent,
        orderId,
        appointmentId,
        service: data.serviceId,
        roomType,
        senderName: data.senderName,
      });

      const populated = await savedMessage.populate([
        { path: 'sender', select: 'firstName lastName avatar role' },
      ]);

      const msgObj = populated.toObject();
      const confirmedMessage = {
        ...msgObj,
        _id: savedMessage._id,
        tempId,
        orderId: orderId || String(msgObj.order || ''),
        appointmentId: appointmentId || String(msgObj.appointment || ''),
        senderId: data.senderId || String(msgObj.sender?._id || msgObj.sender || ''),
        receiverId: data.receiverId || String(msgObj.receiver || ''),
        content: messageContent,
        message: messageContent,
        roomType,
      };

      // Emit confirmed message to replace optimistic
      if (roomType === 'support') {
        this.server.to('admin:support').emit('chat:message-confirmed', confirmedMessage);
        this.server.to(`support:${data.senderId}`).emit('chat:message-confirmed', confirmedMessage);
      } else {
        this.server.to(targetRoom).emit('chat:message-confirmed', confirmedMessage);
      }

      this.logger.log(`[Chat] CONFIRMED message ${savedMessage._id} saved to DB`);
      return { success: true, data: confirmedMessage };
    } catch (error) {
      this.logger.error(`[Chat] handleChatMessage error: ${error.message}`, error.stack);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('chat:typing')
  handleChatTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; roomId: string; roomType?: string; isTyping: boolean },
  ) {
    const roomType = data.roomType || 'support';
    if (roomType === 'support') {
      this.server.to('admin:support').emit('chat:user-typing', data);
      this.server.to(`support:${data.roomId}`).emit('chat:user-typing', data);
    } else if (roomType === 'order') {
      this.server.to(`order:${data.roomId}`).emit('chat:user-typing', data);
    } else {
      this.server.to(`appointment:${data.roomId}`).emit('chat:user-typing', data);
    }
    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════════════
  // PUBLIC METHODS — called by other services
  // ═══════════════════════════════════════════════════════════════════

  sendToUser(
    userId: string,
    notification: { title: string; body: string; type: string; data?: any },
  ) {
    this.server
      .to(`user:${userId}`)
      .emit('notification:new', notification);
    this.logger.log(`Emitted notification:new to user:${userId} (${notification.type})`);
  }

  broadcastToRole(role: string, event: string, payload: any) {
    this.server.emit(event, payload);
    this.logger.log(`Broadcasted ${event} to all connected clients (intended for role: ${role})`);
  }

  broadcastNewOrder(orderData: any) {
    this.server.emit('notification:new-order', orderData);
    this.logger.log(`Broadcasted notification:new-order to all connected clients`);
  }

  sendOrderAccepted(userId: string, data: any) {
    this.server
      .to(`user:${userId}`)
      .emit('notification:order-accepted', data);
    this.logger.log(`Emitted notification:order-accepted to user:${userId}`);
  }

  sendOrderStatusUpdate(userId: string, data: any) {
    this.server
      .to(`user:${userId}`)
      .emit('notification:order-status-update', data);
    this.logger.log(`Emitted notification:order-status-update to user:${userId}`);
  }

  getConnectedUserCount(): number {
    return this.userSockets.size;
  }
}
