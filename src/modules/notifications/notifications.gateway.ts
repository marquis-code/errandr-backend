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
import { OnModuleInit, Logger } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { RedisService } from '../redis/redis.service';

@WebSocketGateway({
  cors: { origin: '*' },
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
  ) {}

  async onModuleInit() {
    const subClient = this.redisService.getNewClient();

    // Subscribe to all notification channels
    await subClient.psubscribe('notification:*');

    subClient.on('pmessage', (pattern, channel, message) => {
      // Channel format: notification:<userId> or notification:broadcast
      const target = channel.split(':').slice(1).join(':');
      if (!target) return;

      try {
        const notification = JSON.parse(message);

        if (target === 'broadcast:erranders') {
          // Broadcast to all connected users (erranders)
          this.server.emit('notification:new-order', notification);
          this.logger.log(`Broadcasted new order to all erranders`);
        } else {
          // Send to specific user
          this.server.to(`user:${target}`).emit('notification:new', notification);
          this.logger.log(`Sent notification to user:${target}`);
        }
      } catch (e) {
        this.logger.error('Failed to parse redis notification:', e);
      }
    });

    this.logger.log('NotificationsGateway initialized — listening on /realtime');
  }

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

  // ─── Public methods called by other services ───

  /**
   * Send a notification to a specific user (via their socket room)
   */
  sendToUser(
    userId: string,
    notification: { title: string; body: string; type: string; data?: any },
  ) {
    this.server
      .to(`user:${userId}`)
      .emit('notification:new', notification);
    this.logger.log(`Emitted notification:new to user:${userId} (${notification.type})`);
  }

  /**
   * Broadcast a message to all users of a specific role (real-time only)
   */
  broadcastToRole(role: string, event: string, payload: any) {
    this.server.emit(event, payload);
    this.logger.log(`Broadcasted ${event} to all connected clients (intended for role: ${role})`);
  }

  /**
   * Broadcast a new order to ALL connected erranders/riders
   */
  broadcastNewOrder(orderData: any) {
    this.server.emit('notification:new-order', orderData);
    this.logger.log(`Broadcasted notification:new-order to all connected clients`);
  }

  /**
   * Emit order-accepted event to a specific user
   */
  sendOrderAccepted(userId: string, data: any) {
    this.server
      .to(`user:${userId}`)
      .emit('notification:order-accepted', data);
    this.logger.log(`Emitted notification:order-accepted to user:${userId}`);
  }

  /**
   * Emit order-status-update event to a specific user
   */
  sendOrderStatusUpdate(userId: string, data: any) {
    this.server
      .to(`user:${userId}`)
      .emit('notification:order-status-update', data);
    this.logger.log(`Emitted notification:order-status-update to user:${userId}`);
  }

  /**
   * Get count of currently connected users
   */
  getConnectedUserCount(): number {
    return this.userSockets.size;
  }
}
