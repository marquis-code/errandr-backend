import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { RedisService } from '../redis/redis.service';
import { User } from '../users/schemas/user.schema';

@WebSocketGateway({
  cors: {
    origin: (origin, callback) => {
      callback(null, true);
    },
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private connectedUsers = new Map<string, string>(); // userId -> socketId

  constructor(
    private chatService: ChatService,
    private redisService: RedisService,
    private jwtService: JwtService,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  /**
   * Reject unauthenticated sockets BEFORE they can join rooms or emit events.
   * Mirrors the REST JwtAuthGuard/JwtStrategy: the very same JWT secret
   * (ChatModule registers JwtModule with JWT_SECRET) and the same `sub` claim.
   */
  afterInit(server: any) {
    if (typeof server?.use !== 'function') {
      this.logger.warn(
        'namespace middleware unavailable — falling back to connection-time auth',
      );
      return;
    }
    server.use(async (socket: Socket, next: (err?: Error) => void) => {
      try {
        socket.data.userId = await this.authenticate(socket);
        next();
      } catch (error) {
        this.logger.warn(
          `rejected socket ${socket.id} on /chat: ${error?.message || error}`,
        );
        next(new Error('Unauthorized: invalid or missing token'));
      }
    });
  }

  /**
   * Verify the handshake JWT and derive the identity FROM THE TOKEN.
   * `handshake.query.userId` is never trusted (it is only logged on mismatch).
   */
  private async authenticate(client: Socket): Promise<string> {
    const token = this.extractToken(client);
    if (!token) {
      throw new Error('missing auth token');
    }
    const payload: any = await this.jwtService.verifyAsync(token);
    const rawId = payload?.sub || payload?.userId || payload?._id;
    if (!rawId) {
      throw new Error('token has no subject');
    }
    const userId = String(rawId);
    // Same liveness check the REST JwtStrategy performs.
    const user: any = await this.userModel
      .findById(userId)
      .select('isActive')
      .lean();
    if (!user) {
      throw new Error('user not found');
    }
    if (user.isActive === false) {
      throw new Error('user is inactive');
    }
    const claimed = client.handshake?.query?.userId as string | undefined;
    if (claimed && claimed !== userId) {
      this.logger.warn(
        `socket ${client.id} claimed userId=${claimed} but its token belongs to ${userId}; using the token identity`,
      );
    }
    return userId;
  }

  /** auth.token (mobile/web socket.io), Authorization header, query token or cookie. */
  private extractToken(client: Socket): string | null {
    const auth: any = client.handshake?.auth;
    const headers: any = client.handshake?.headers;
    const query: any = client.handshake?.query;
    const header = typeof headers?.authorization === 'string' ? headers.authorization : '';
    const raw =
      (typeof auth?.token === 'string' && auth.token) ||
      (header.toLowerCase().startsWith('bearer ') ? header.slice(7) : undefined) ||
      (typeof query?.token === 'string' && query.token) ||
      this.tokenFromCookie(headers?.cookie) ||
      null;
    if (!raw) return null;
    const token = String(raw).replace(/^Bearer\s+/i, '').trim();
    return token.length ? token : null;
  }

  private tokenFromCookie(cookieHeader?: string): string | null {
    if (!cookieHeader) return null;
    for (const part of cookieHeader.split(';')) {
      const [name, ...rest] = part.trim().split('=');
      if (['token', 'access_token', 'errandr_token', 'jwt'].includes(name)) {
        const value = decodeURIComponent(rest.join('='));
        if (value) return value;
      }
    }
    return null;
  }

  handleConnection(client: Socket) {
    const verified = client.data?.userId as string | undefined;
    if (verified) {
      this.registerConnection(client, verified);
      return;
    }
    // Defensive: if namespace middleware could not run, verify before use.
    this.authenticate(client)
      .then((userId) => {
        client.data.userId = userId;
        this.registerConnection(client, userId);
      })
      .catch((error) => {
        this.logger.warn(
          `rejected socket ${client.id} on /chat: ${error?.message || error}`,
        );
        client.emit('unauthorized', { message: 'Invalid or missing token' });
        client.disconnect(true);
      });
  }

  private registerConnection(client: Socket, userId: string) {
    this.connectedUsers.set(userId, client.id);
    void this.redisService
      .hset('online:users', userId, client.id)
      .catch(() => undefined);
    this.logger.log(`User ${userId} connected to chat`);
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

  /** Canonical pair key — the same rule the send path and the join path use. */
  private pairKeyFor(a?: string, b?: string): string | undefined {
    if (!a || !b) return undefined;
    const ids = [String(a), String(b)].sort();
    return `${ids[0]}_${ids[1]}`;
  }

  /** Canonical order room name (pair-specific when a pair key is known). */
  private orderRoom(orderId?: string, pairKey?: string): string {
    return pairKey ? `order:${orderId}:${pairKey}` : `order:${orderId}`;
  }

  /**
   * Resolve the room(s) a chat event must be delivered to, reusing the exact
   * naming rules of handleJoinOrder / handleMessage. It prefers the rooms this
   * socket actually joined for the given chat scope (that is where the peer
   * sits), then falls back to the deterministically computed room.
   */
  private resolveChatRooms(client: Socket, data: any = {}): string[] {
    const orderId =
      data.orderId || (data.roomType === 'order' ? data.roomId : undefined);
    const appointmentId =
      data.appointmentId ||
      (data.roomType === 'direct' &&
      data.roomId &&
      !String(data.roomId).includes('_')
        ? data.roomId
        : undefined);
    const directRoomId =
      data.roomId && String(data.roomId).includes('_') && data.roomType !== 'order'
        ? data.roomId
        : undefined;

    let prefixes: string[];
    if (orderId) {
      prefixes = [`order:${orderId}`];
    } else if (appointmentId) {
      prefixes = [`appointment:${appointmentId}`];
    } else if (directRoomId) {
      prefixes = [`direct:${directRoomId}`];
    } else if (data.roomType === 'direct' && data.roomId) {
      prefixes = [`direct:${data.roomId}`];
    } else {
      prefixes = [
        `support:${data.roomId || data.userId || client.data?.userId || ''}`,
      ];
    }

    const joined = Array.from(((client as any).rooms || []) as Set<string>);
    const matched = joined.filter((room) =>
      prefixes.some(
        (prefix) => room === prefix || room.startsWith(`${prefix}:`),
      ),
    );
    if (matched.length) {
      return matched;
    }

    // Not joined (yet): compute the pair-specific room the send path would use.
    // NOTE: `data.userId` is the *sender* on the mobile payloads, so only
    // explicit "other party" fields may be used to build the pair key.
    if (orderId) {
      const pairKey =
        data.pairKey ||
        this.pairKeyFor(
          client.data?.userId,
          data.receiverId || data.targetUserId || data.toUserId || data.peerId,
        );
      if (pairKey) {
        return [this.orderRoom(orderId, pairKey)];
      }
    }
    return prefixes;
  }

  // NOTE: NestJS binds only ONE message per method — the last decorator applied
  // (i.e. the top one) wins. Every alias therefore needs its own thin method.
  @SubscribeMessage('joinOrder')
  handleJoinOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId?: string; appointmentId?: string; roomId?: string; userId?: string; roomType?: string; pairKey?: string },
  ) {
    const id = data.roomId || data.appointmentId || data.orderId || data.userId;
    if (data.orderId || (data.roomId && data.roomType === 'order')) {
      // Join the pair-specific room if pairKey is provided, otherwise the general order room
      const orderRoom = this.orderRoom(id, data.pairKey);
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

  @SubscribeMessage('joinAppointment')
  handleJoinAppointment(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    return this.handleJoinOrder(client, data);
  }

  @SubscribeMessage('chat:join-room')
  handleChatJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    return this.handleJoinOrder(client, data);
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
      serviceId?: string;
      senderName?: string;
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
        const pairKey =
          (data as any).pairKey ||
          this.pairKeyFor(data.senderId, data.receiverId) ||
          [data.senderId, data.receiverId].sort().join('_');
        targetRoom = this.orderRoom(orderId, pairKey);
      } else if (roomType === 'order') {
        targetRoom = this.orderRoom(orderId);
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
        service: data.serviceId,
        createdAt: new Date().toISOString(),
        senderType: 'customer',
      };

      // *** EMIT IMMEDIATELY - zero-latency broadcast ***
      if (roomType === 'support') {
        let broadcast = this.server.to('admin:support').to(`support:${data.senderId}`);
        if (data.receiverId) {
          broadcast = broadcast.to(`support:${data.receiverId}`);
        }
        broadcast.emit('chat:new-message', optimisticMessage);
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
        service: data.serviceId,
        roomType,
        senderName: data.senderName,
        senderPhone: (data as any).senderPhone || (data as any).userPhone,
        senderEmail: (data as any).senderEmail || (data as any).userEmail
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

  @SubscribeMessage('chat:send-message')
  async handleChatSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    return this.handleMessage(client, data);
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    // `isTyping: data.isTyping !== false` keeps an explicit `false` meaningful
    // while a bare `typing` event always means "started typing".
    this.broadcastTyping(client, data || {}, data?.isTyping !== false);
    return { success: true };
  }

  @SubscribeMessage('chat:typing')
  handleChatTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    return this.handleTyping(client, data);
  }

  @SubscribeMessage('stopTyping')
  handleStopTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    this.broadcastTyping(client, data || {}, false);
    return { success: true };
  }

  @SubscribeMessage('chat:stop-typing')
  handleChatStopTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    return this.handleStopTyping(client, data);
  }

  /**
   * Emit the typing state to the SAME room(s) the send/join paths use — the
   * old `support:<id>` routing never reached the peer sitting in
   * `order:<orderId>:<pairKey>` or `direct:<roomId>`.
   */
  private broadcastTyping(client: Socket, data: any, isTyping: boolean) {
    const me = client.data?.userId as string | undefined;
    const rooms = this.resolveChatRooms(client, data);
    const payload = {
      userId: me || data.userId || data.senderId || '',
      senderId: me || data.senderId || data.userId || '',
      isTyping,
      roomId:
        data.roomId ||
        data.appointmentId ||
        data.orderId ||
        data.userId ||
        me ||
        '',
      orderId: data.orderId,
      appointmentId: data.appointmentId,
      roomType: data.roomType,
    };
    // `chat:user-typing` is the canonical event; the aliases keep the older
    // listeners (`userTyping`, legacy `typing`/`stopTyping`) working.
    const events = [
      'chat:user-typing',
      'userTyping',
      isTyping ? 'typing' : 'stopTyping',
    ];
    for (const room of rooms) {
      for (const event of events) {
        client.to(room).emit(event, payload);
      }
    }
  }

  @SubscribeMessage('markRead')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    const userId = (client.data?.userId as string) || data?.userId;
    const id = data?.roomId || data?.orderId || '';
    if (userId) {
      await this.chatService.markAllAsRead(id, userId);
    }
    // Emit to the pair/direct room the readers and their peer actually joined
    // (was hard-coded to `order:<id>`, which nobody joins).
    const rooms = this.resolveChatRooms(client, data || {});
    const payload = {
      userId,
      roomId: id,
      orderId: data?.orderId,
      appointmentId: data?.appointmentId,
      roomType: data?.roomType,
    };
    for (const room of rooms) {
      this.server.to(room).emit('messagesRead', payload);
    }
    return { success: true, rooms };
  }

  @SubscribeMessage('chat:mark-read')
  async handleChatMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    return this.handleMarkRead(client, data);
  }

  /**
   * Leave the room(s) the join path produced so membership does not leak until
   * disconnect. Mobile emits `leaveOrder`; the web emits `leaveOrder` /
   * `leaveAppointment` (and `leaveRoom` is kept as an alias).
   */
  @SubscribeMessage('leaveOrder')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    const rooms = this.resolveChatRooms(client, data || {});
    for (const room of rooms) {
      client.leave(room);
    }
    this.logger.log(
      `${client.data?.userId || client.id} left room(s): ${rooms.join(', ') || 'none'}`,
    );
    return { success: true, event: 'left', data: { rooms } };
  }

  @SubscribeMessage('leaveAppointment')
  handleLeaveAppointment(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    return this.handleLeaveRoom(client, data);
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoomAlias(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    return this.handleLeaveRoom(client, data);
  }

  @SubscribeMessage('chat:leave-room')
  handleChatLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    return this.handleLeaveRoom(client, data);
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
