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
import { NotificationsService } from './notifications.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private userSockets = new Map<string, string>();

  constructor(private notificationsService: NotificationsService) {}

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      this.userSockets.set(userId, client.id);
      client.join(`user:${userId}`);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = [...this.userSockets.entries()].find(
      ([, sid]) => sid === client.id,
    )?.[0];
    if (userId) {
      this.userSockets.delete(userId);
    }
  }

  @SubscribeMessage('getNotifications')
  async handleGetNotifications(@ConnectedSocket() client: Socket) {
    const userId = client.handshake.query.userId as string;
    const notifications =
      await this.notificationsService.getNotifications(userId);
    return notifications;
  }

  @SubscribeMessage('markRead')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { notificationId: string },
  ) {
    const userId = client.handshake.query.userId as string;
    await this.notificationsService.markAsRead(userId, data.notificationId);
    return { success: true };
  }

  // Called by services to push notification to connected user
  sendToUser(
    userId: string,
    notification: { title: string; body: string; type: string; data?: any },
  ) {
    this.server
      .to(`user:${userId}`)
      .emit('notification', notification);
  }
}
