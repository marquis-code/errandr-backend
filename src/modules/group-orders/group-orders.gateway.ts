import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, Logger } from '@nestjs/common';
import { WsJwtAuthGuard } from '../../common/decorators';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/realtime',
})
export class GroupOrdersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GroupOrdersGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() inviteCode: string,
  ) {
    client.join(inviteCode);
    this.logger.log(`Client ${client.id} joined room ${inviteCode}`);
  }

  @SubscribeMessage('leave-room')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() inviteCode: string,
  ) {
    client.leave(inviteCode);
    this.logger.log(`Client ${client.id} left room ${inviteCode}`);
  }

  broadcastUpdate(inviteCode: string, data: any) {
    this.server.to(inviteCode).emit('group-order-updated', data);
  }

  broadcastMemberJoined(inviteCode: string, user: any) {
    this.server.to(inviteCode).emit('member-joined', user);
  }

  broadcastItemsUpdated(inviteCode: string, data: { userId: string, items: any[], total: number }) {
    this.server.to(inviteCode).emit('items-updated', data);
  }

  broadcastStatusChanged(inviteCode: string, status: string) {
    this.server.to(inviteCode).emit('status-changed', status);
  }
}
