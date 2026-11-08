import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Observable } from 'rxjs';

/**
 * Records that a rider is still using the app.
 *
 * Without this, 'available' is a setting somebody flipped once and may never revisit. The
 * alerting above it then reports riders as present long after they closed the tab, and the
 * team resumes promotion into a campus with nobody on the road.
 *
 * Throttled in memory to one write per rider every two minutes: a heartbeat is worth a write,
 * not a write per request.
 */
@Injectable()
export class RiderHeartbeatInterceptor implements NestInterceptor {
  private readonly lastWrite = new Map<string, number>();
  private readonly windowMs = 2 * 60 * 1000;

  constructor(@InjectModel('Errander') private readonly erranderModel: Model<any>) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    try {
      const req: any = context.switchToHttp().getRequest();
      const userId = req?.user?._id?.toString?.() || req?.user?.id;
      const role = String(req?.user?.role || '').toLowerCase();

      if (userId && (role === 'errander' || role === 'rider' || role === 'dispatch')) {
        const now = Date.now();
        const last = this.lastWrite.get(userId) || 0;
        if (now - last > this.windowMs) {
          this.lastWrite.set(userId, now);
          // Fire and forget: a heartbeat must never slow or fail a real request.
          this.erranderModel
            .updateOne({ user: req.user._id }, { $set: { lastActiveAt: new Date() } })
            .catch(() => {});
        }
      }
    } catch {
      // Never let telemetry break a request.
    }

    return next.handle();
  }
}
