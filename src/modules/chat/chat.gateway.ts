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
  @SubscribeMessage('joinAppointment')
  @SubscribeMessage('chat:join-room')
  handleJoinOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId?: string; appointmentId?: string; roomId?: string; userId?: string; roomType?: string; pairKey?: string },
  ) {
    const id = data.roomId || data.appointmentId || data.orderId || data.userId;
    if (data.orderId || (data.roomId && data.roomType === 'order')) {
      // Join the pair-specific room if pairKey is provided, otherwise the general order room
      const orderRoom = data.pairKey ? `order:${id}:${data.pairKey}` : `order:${id}`;
      client.join(orderRoom);
      console.log(`[ChatGateway] Client joined room: ${orderRoom}`);
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
      appointmentId?: string;
      roomId?: string; // Standardized
      senderId: string;
      receiverId?: string;
      message?: string; // Backend was using 'message'
      content?: string; // Frontend is using 'content'
      messageType?: string;
      roomType?: string;
      attachment?: string;
      replyTo?: string;
    },
  ) {
    const messageContent = data.content || data.message || '';
    const orderId = data.orderId || (data.roomType === 'order' ? data.roomId : undefined);
    // If it's a generic direct chat, it might have roomId like "userId_vendorId"
    let appointmentId = data.appointmentId;
    if (data.roomType === 'direct' && data.roomId && !data.roomId.includes('_')) {
      appointmentId = data.roomId;
    }
    const roomType = data.roomType || (orderId ? 'order' : (appointmentId ? 'direct' : 'support'));
    
    try {
      // Generate a temporary ID for immediate emit
      const tempId = new Date().getTime().toString() + Math.random().toString(36).substr(2, 9);
      
      // Determine target room FIRST (no DB needed)
      let targetRoom = `support:${data.senderId}`;
      if (roomType === 'order' && data.receiverId) {
        // Build a deterministic pairKey so both users are in the same room
        const ids = [data.senderId, data.receiverId].sort();
        const pairKey = `${ids[0]}_${ids[1]}`;
        targetRoom = `order:${orderId}:${pairKey}`;
      } else if (roomType === 'order') {
        targetRoom = `order:${orderId}`;
      }
      if (roomType === 'direct') {
        targetRoom = appointmentId ? `appointment:${appointmentId}` : `direct:${data.roomId || `${Math.min(data.senderId as any, data.receiverId as any)}_${Math.max(data.senderId as any, data.receiverId as any)}`}`;
      }

      // Build optimistic message for IMMEDIATE emit (no DB round-trip)
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
        sender: { _id: data.senderId }, // minimal sender info
        receiver: data.receiverId ? { _id: data.receiverId } : undefined,
        order: orderId,
        appointment: appointmentId,
        createdAt: new Date().toISOString(),
        senderType: 'customer',
      };

      // *** EMIT IMMEDIATELY - zero-latency broadcast ***
      if (roomType === 'support') {
        this.server.to('admin:support').emit('chat:new-message', optimisticMessage);
        this.server.to(`support:${data.senderId}`).emit('chat:new-message', optimisticMessage);
      } else {
        this.server.to(targetRoom).emit('chat:new-message', optimisticMessage);
        this.server.to(targetRoom).emit('newMessage', optimisticMessage);
      }

      // Also emit directly to receiverId's socket if connected
      if (data.receiverId) {
        const receiverSocketId = this.connectedUsers.get(data.receiverId);
        if (receiverSocketId) {
          this.server.to(receiverSocketId).emit('newMessage', optimisticMessage);
          this.server.to(receiverSocketId).emit('newMessageNotification', optimisticMessage);
        }
      }

      console.log(`[ChatGateway] INSTANT broadcast tempId=${tempId} from ${data.senderId} to room ${targetRoom}`);

      // NOW save to DB (this can take time with remote MongoDB, but the UI already updated)
      const savedMessage = await this.chatService.createMessage({ 
        ...data, 
        message: messageContent,
        orderId,
        appointmentId,
        roomType 
      });
      
      const populated = await savedMessage.populate([
        { path: 'sender', select: 'firstName lastName avatar role' },
      ]);

      const msgObj = populated.toObject();
      const confirmedMessage = {
        ...msgObj,
        _id: savedMessage._id,
        tempId, // so frontend can replace the optimistic message
        orderId: orderId || String(msgObj.order || ''),
        appointmentId: appointmentId || String(msgObj.appointment || ''),
        senderId: data.senderId || String(msgObj.sender?._id || msgObj.sender || ''),
        receiverId: data.receiverId || String(msgObj.receiver?._id || msgObj.receiver || ''),
        message: messageContent,
        content: messageContent,
        senderType: populated.sender?.['role'] === 'admin' ? 'support' : 'customer'
      };

      // Emit the confirmed message with real _id so frontends can upgrade the temp message
      if (roomType !== 'support') {
        this.server.to(targetRoom).emit('messageConfirmed', confirmedMessage);
      }

      // Bot logic for support (fire-and-forget)
      if (roomType === 'support') {
        this.chatService.getBotResponse(messageContent).then(async (botResponse) => {
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
        }).catch(err => console.error('Bot response error:', err));
      }

    // Fire-and-forget: look up all order/appointment participants for notifications
    // This runs in background and does NOT block the return
    (async () => {
      try {
        const notifyTargets: string[] = [];
        if (data.receiverId) notifyTargets.push(data.receiverId);
        
        if (orderId) {
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
        }
        
        if (appointmentId) {
          const appointment = await this.chatService.getAppointmentParticipants(appointmentId);
          if (appointment) {
            const participants = [
              appointment.user?._id?.toString() || appointment.user?.toString(),
              appointment.vendor?.owner?.toString() || appointment.vendor?._id?.toString() || appointment.vendor?.toString(),
            ].filter(Boolean);
            for (const p of participants) {
              if (p && p !== data.senderId && !notifyTargets.includes(p)) {
                notifyTargets.push(p);
              }
            }
          }
        }

        // Emit notification to each connected participant
        for (const targetId of notifyTargets) {
          const socketId = this.connectedUsers.get(targetId);
          if (socketId) {
            this.server.to(socketId).emit('newMessageNotification', confirmedMessage);
          }
        }
      } catch (e) {
        console.error('Background participant notification error:', e);
      }
    })();

    return { success: true, message: confirmedMessage };
    } catch (error) {
      console.error('Failed to handle chat message:', error);
      return { success: false, error: error.message || 'Internal server error' };
    }
  }

  @SubscribeMessage('typing')
  @SubscribeMessage('chat:typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
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
    @MessageBody() data: any,
  ) {
    const id = data.roomId || data.orderId || '';
    await this.chatService.markAllAsRead(id, data.userId);
    const room = (data.roomType === 'support' || !data.orderId) ? `support:${data.userId}` : `order:${id}`;
    this.server.to(room).emit('messagesRead', {
      userId: data.userId,
    });
  }

  // WebRTC Signaling Events
  @SubscribeMessage('call:initiate')
  handleCallInitiate(@MessageBody() data: any) {
    const receiverSocketId = this.connectedUsers.get(data.receiverId);
    if (receiverSocketId) {
      this.server.to(receiverSocketId).emit('call:incoming', data);
    }
  }

  @SubscribeMessage('call:accept')
  handleCallAccept(@MessageBody() data: any) {
    const callerSocketId = this.connectedUsers.get(data.callerId);
    if (callerSocketId) {
      this.server.to(callerSocketId).emit('call:accepted', data);
    }
  }

  @SubscribeMessage('call:reject')
  handleCallReject(@MessageBody() data: any) {
    const callerSocketId = this.connectedUsers.get(data.callerId);
    if (callerSocketId) {
      this.server.to(callerSocketId).emit('call:rejected', data);
    }
  }

  @SubscribeMessage('call:end')
  handleCallEnd(@MessageBody() data: any) {
    const targetSocketId = this.connectedUsers.get(data.targetId);
    if (targetSocketId) {
      this.server.to(targetSocketId).emit('call:ended', data);
    }
  }

  @SubscribeMessage('webrtc:offer')
  handleWebrtcOffer(@MessageBody() data: any) {
    const targetSocketId = this.connectedUsers.get(data.targetId);
    if (targetSocketId) {
      this.server.to(targetSocketId).emit('webrtc:offer', data);
    }
  }

  @SubscribeMessage('webrtc:answer')
  handleWebrtcAnswer(@MessageBody() data: any) {
    const targetSocketId = this.connectedUsers.get(data.targetId);
    if (targetSocketId) {
      this.server.to(targetSocketId).emit('webrtc:answer', data);
    }
  }

  @SubscribeMessage('webrtc:ice-candidate')
  handleWebrtcIceCandidate(@MessageBody() data: any) {
    const targetSocketId = this.connectedUsers.get(data.targetId);
    if (targetSocketId) {
      this.server.to(targetSocketId).emit('webrtc:ice-candidate', data);
    }
  }
}
