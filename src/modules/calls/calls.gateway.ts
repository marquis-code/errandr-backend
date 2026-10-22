import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { CallsService } from './calls.service';
import { CallStatus, CallType } from './schemas/call-session.schema';

/**
 * Call signalling.
 *
 * WebRTC needs a channel to exchange an offer, an answer and ICE candidates before any
 * media flows — there is no way to do it over REST. This gateway is that channel: it
 * authorises every call against the order (see CallsService) and relays the handshake.
 *
 * Media never touches this server; it flows peer to peer.
 */
@WebSocketGateway({
  cors: { origin: (_origin: string, callback: (e: null, ok: boolean) => void) => callback(null, true), credentials: true },
  namespace: '/calls',
})
export class CallsGateway implements OnGatewayInit {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(CallsGateway.name);

  /** userId -> socketId, so an incoming call can be routed to the right person. */
  private online = new Map<string, string>();

  constructor(
    private readonly calls: CallsService,
    private readonly jwt: JwtService,
  ) {}

  afterInit(server: any) {
    // Same auth contract as the chat namespace: the JWT `sub` claim is the user id.
    server.use(async (socket: Socket, next: (err?: Error) => void) => {
      try {
        const token = String(
          socket.handshake.auth?.token ||
            socket.handshake.headers?.authorization?.toString().replace(/^Bearer\s+/i, '') ||
            '',
        );
        if (!token) throw new Error('missing token');
        const payload: any = await this.jwt.verifyAsync(token);
        socket.data.userId = payload.sub;
        this.online.set(String(payload.sub), socket.id);
        next();
      } catch {
        next(new Error('unauthorized'));
      }
    });

    server.on('connection', (socket: Socket) => {
      socket.on('disconnect', () => {
        const userId = socket.data?.userId;
        if (userId && this.online.get(String(userId)) === socket.id) {
          this.online.delete(String(userId));
        }
      });
    });
  }

  private emitTo(userId: string, event: string, payload: unknown) {
    const socketId = this.online.get(String(userId));
    if (socketId) this.server.to(socketId).emit(event, payload);
  }

  /** Start a call. The callee receives `call:incoming` on every open tab. */
  @SubscribeMessage('call:start')
  async onStart(
    @MessageBody() body: { orderId: string; toUserId: string; type?: CallType },
    @ConnectedSocket() socket: Socket,
  ) {
    const callerId = String(socket.data.userId);
    try {
      const call = await this.calls.start(
        body?.orderId,
        callerId,
        String(body?.toUserId || ''),
        body?.type === CallType.VIDEO ? CallType.VIDEO : CallType.VOICE,
      );

      const payload = {
        callId: String(call._id),
        orderId: String(call.order),
        callerId,
        calleeId: String(call.callee),
        type: call.type,
        status: call.status,
      };

      // Echo to the caller so their UI can show "ringing" with the real call id.
      socket.emit('call:ringing', payload);
      this.emitTo(String(call.callee), 'call:incoming', payload);
      return { ok: true, call: payload };
    } catch (error: any) {
      const message = error?.response?.message || error?.message || 'Could not place the call.';
      socket.emit('call:error', { message });
      return { ok: false, message };
    }
  }

  @SubscribeMessage('call:accept')
  async onAccept(@MessageBody() body: { callId: string }, @ConnectedSocket() socket: Socket) {
    try {
      const call = await this.calls.accept(body?.callId, String(socket.data.userId));
      this.emitTo(String(call.caller), 'call:accepted', { callId: String(call._id) });
      this.emitTo(String(call.callee), 'call:accepted', { callId: String(call._id) });
      return { ok: true };
    } catch (error: any) {
      return { ok: false, message: error?.response?.message || error?.message };
    }
  }

  @SubscribeMessage('call:decline')
  async onDecline(@MessageBody() body: { callId: string }, @ConnectedSocket() socket: Socket) {
    try {
      const call = await this.calls.decline(body?.callId, String(socket.data.userId));
      this.emitTo(String(call.caller), 'call:declined', { callId: String(call._id) });
      this.emitTo(String(call.callee), 'call:declined', { callId: String(call._id) });
      return { ok: true };
    } catch (error: any) {
      return { ok: false, message: error?.response?.message || error?.message };
    }
  }

  @SubscribeMessage('call:end')
  async onEnd(@MessageBody() body: { callId: string }, @ConnectedSocket() socket: Socket) {
    try {
      const call = await this.calls.end(body?.callId, String(socket.data.userId));
      const payload = {
        callId: String(call._id),
        status: call.status,
        durationSeconds: call.durationSeconds,
      };
      this.emitTo(String(call.caller), 'call:ended', payload);
      this.emitTo(String(call.callee), 'call:ended', payload);
      return { ok: true, call: payload };
    } catch (error: any) {
      return { ok: false, message: error?.response?.message || error?.message };
    }
  }

  /**
   * Relay the WebRTC handshake. The server checks the sender is a party to the call, then
   * forwards to the other one — it never inspects the SDP.
   */
  @SubscribeMessage('call:signal')
  async onSignal(
    @MessageBody() body: { callId: string; data: unknown },
    @ConnectedSocket() socket: Socket,
  ) {
    const userId = String(socket.data.userId);
    try {
      const call = await this.calls.getForParty(body?.callId, userId);
      if (call.status !== CallStatus.ACTIVE && call.status !== CallStatus.RINGING) {
        return { ok: false, message: 'This call has ended.' };
      }
      const otherId = String(call.caller) === userId ? String(call.callee) : String(call.caller);
      this.emitTo(otherId, 'call:signal', { callId: String(call._id), from: userId, data: body?.data });
      return { ok: true };
    } catch (error: any) {
      return { ok: false, message: error?.response?.message || error?.message };
    }
  }
}
