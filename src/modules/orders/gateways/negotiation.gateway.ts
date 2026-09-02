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
import { NegotiationService } from '../services/negotiation.service';

import { RedisService } from '../../redis/redis.service';

@WebSocketGateway({
  cors: {
    origin: (origin, callback) => {
      callback(null, true);
    },
    credentials: true,
  },
  namespace: '/negotiation',
})
export class NegotiationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  // Track viewers per order: { orderId: Set<socketId> }
  private orderViewers: Map<string, Set<string>> = new Map();

  constructor(
    private negotiationService: NegotiationService,
    private redisService: RedisService
  ) {
    this.setupRedisSubscriber();
  }

  private async setupRedisSubscriber() {
    const subClient = this.redisService.getNewClient();
    await subClient.psubscribe('notification:broadcast:negotiation');
    
    subClient.on('pmessage', (pattern, channel, message) => {
      if (channel === 'notification:broadcast:negotiation') {
        try {
          const data = JSON.parse(message);
          if (data.type === 'BID_COUNTERED') {
            this.server.to(`negotiation:${data.orderId}`).emit('bidCountered', data.bid);
          } else if (data.type === 'BID_ACCEPTED_DIRECTLY') {
            this.server.to(`negotiation:${data.orderId}`).emit('orderAcceptedDirectly', data.payload);
          } else if (data.type === 'BID_REJECTED') {
            this.server.to(`negotiation:${data.orderId}`).emit('bidRejected', data.bid);
          }
        } catch (e) {
          console.error('Failed to process negotiation broadcast', e);
        }
      }
    });
  }

  handleConnection(client: Socket) {
    console.log(`Negotiation client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Negotiation client disconnected: ${client.id}`);
    
    // Remove from any viewer lists
    this.orderViewers.forEach((viewers, orderId) => {
      if (viewers.has(client.id)) {
        viewers.delete(client.id);
        this.broadcastViewerCount(orderId);
      }
    });
  }

  private broadcastViewerCount(orderId: string) {
    const viewers = this.orderViewers.get(orderId)?.size || 0;
    this.server.to(`negotiation:${orderId}`).emit('viewerCountUpdate', {
      orderId,
      count: viewers,
    });
  }

  @SubscribeMessage('joinNegotiation')
  handleJoinNegotiation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string, role: 'student' | 'rider' },
  ) {
    client.join(`negotiation:${data.orderId}`);
    
    if (data.role === 'rider') {
      if (!this.orderViewers.has(data.orderId)) {
        this.orderViewers.set(data.orderId, new Set());
      }
      this.orderViewers.get(data.orderId)!.add(client.id);
      this.broadcastViewerCount(data.orderId);
    }
    
    return { event: 'joined', data: { orderId: data.orderId } };
  }

  @SubscribeMessage('leaveNegotiation')
  handleLeaveNegotiation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string, role: 'student' | 'rider' },
  ) {
    client.leave(`negotiation:${data.orderId}`);
    
    if (data.role === 'rider') {
      if (this.orderViewers.has(data.orderId)) {
        this.orderViewers.get(data.orderId)!.delete(client.id);
        this.broadcastViewerCount(data.orderId);
      }
    }
  }

  @SubscribeMessage('submitBid')
  async handleSubmitBid(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string; riderId: string; bidAmount: number },
  ) {
    try {
      const bid = await this.negotiationService.submitBid(data.orderId, data.riderId, data.bidAmount);
      const populatedBid = await bid.populate('rider', 'firstName lastName avatar phone');
      
      const plainBid = populatedBid.toObject();

      // Broadcast bid to student (and other riders listening)
      this.server.to(`negotiation:${data.orderId}`).emit('newBid', plainBid);
      return { success: true, bid: plainBid };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  @SubscribeMessage('acceptBid')
  async handleAcceptBid(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string; bidId: string },
  ) {
    try {
      const result = await this.negotiationService.acceptBid(data.orderId, data.bidId);
      
      // Broadcast acceptance to everyone
      this.server.to(`negotiation:${data.orderId}`).emit('bidAccepted', {
        orderId: data.orderId,
        bidId: data.bidId,
        riderId: result.bid.rider,
        agreedDeliveryFee: result.bid.bidAmount,
        total: result.order.total
      });
      return { success: true, total: result.order.total };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  sendOrderAcceptedDirectly(orderId: string, payload: any) {
    this.server.to(`negotiation:${orderId}`).emit('orderAcceptedDirectly', payload);
  }
}
