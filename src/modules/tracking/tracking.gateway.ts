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
import { TrackingService } from './tracking.service';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  namespace: '/tracking',
})
export class TrackingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(private trackingService: TrackingService) {}

  handleConnection(client: Socket) {
    console.log(`Tracking client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Tracking client disconnected: ${client.id}`);
  }

  @SubscribeMessage('trackOrder')
  handleTrackOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string },
  ) {
    client.join(`track:${data.orderId}`);
    return { event: 'tracking', data: { orderId: data.orderId } };
  }

  @SubscribeMessage('stopTracking')
  handleStopTracking(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string },
  ) {
    client.leave(`track:${data.orderId}`);
  }

  @SubscribeMessage('updateLocation')
  async handleUpdateLocation(
    @MessageBody()
    data: {
      erranderId: string;
      orderId: string;
      coordinates: number[];
    },
  ) {
    // Store location
    await this.trackingService.updateErranderLocation(
      data.erranderId,
      data.coordinates,
    );

    // Update order tracking
    await this.trackingService.updateOrderTracking(data.orderId, {
      erranderLocation: data.coordinates,
      status: 'in_transit',
    });

    // Broadcast to everyone tracking this order
    this.server.to(`track:${data.orderId}`).emit('locationUpdate', {
      orderId: data.orderId,
      erranderId: data.erranderId,
      coordinates: data.coordinates,
      timestamp: new Date(),
    });

    return { success: true };
  }

  @SubscribeMessage('orderStatusUpdate')
  handleOrderStatusUpdate(
    @MessageBody() data: { orderId: string; status: string; note?: string },
  ) {
    this.server.to(`track:${data.orderId}`).emit('statusUpdate', {
      orderId: data.orderId,
      status: data.status,
      note: data.note,
      timestamp: new Date(),
    });
  }
}
