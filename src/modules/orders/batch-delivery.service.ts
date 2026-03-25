import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RedisService } from '../redis/redis.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserRole } from '../users/schemas/user.schema';

@Injectable()
export class BatchDeliveryService {
  private readonly logger = new Logger(BatchDeliveryService.name);
  private readonly REDIS_KEY = 'batch_delivery_active';

  constructor(
    private redisService: RedisService,
    private notificationsService: NotificationsService,
    private notificationsGateway: NotificationsGateway,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  @Cron('0 8 * * *') // 8:00 AM
  async startMorningWindow() {
    this.logger.log('Starting morning batch delivery window (8-10am)');
    await this.activateBatchWindow('Morning Batch Delivery is LIVE! 🚀 Plan your day and order now for faster campus-wide dispatch.');
  }

  @Cron('0 10 * * *') // 10:00 AM
  async endMorningWindow() {
    this.logger.log('Ending morning batch delivery window');
    await this.deactivateBatchWindow();
  }

  @Cron('0 14 * * *') // 2:00 PM
  async startAfternoonWindow() {
    this.logger.log('Starting afternoon batch delivery window (2-4pm)');
    await this.activateBatchWindow('Afternoon Batch Delivery is LIVE! 📦 Get your lunch and snacks delivered quickly with our bulk dispatch.');
  }

  @Cron('0 16 * * *') // 4:00 PM
  async endAfternoonWindow() {
    this.logger.log('Ending afternoon batch delivery window');
    await this.deactivateBatchWindow();
  }

  private async activateBatchWindow(message: string) {
    await this.redisService.set(this.REDIS_KEY, 'true', 7200); // 2 hours
    
    // Notify all students
    const students = await this.userModel.find({ role: UserRole.STUDENT }).select('_id');
    const studentIds = students.map(s => s._id.toString());

    // Broadcast real-time
    this.notificationsGateway.broadcastToRole(UserRole.STUDENT, 'notification:batch-started', {
      title: '🚀 Batch Delivery Window',
      message,
      isActive: true,
    });

    // We don't want to spam everyone's persistent notification list with every window, 
    // but we can send to those currently online or just use the real-time toast.
    // The user asked for a "banner on the website", which we'll implement via an API check.
  }

  private async deactivateBatchWindow() {
    await this.redisService.del(this.REDIS_KEY);
    this.notificationsGateway.broadcastToRole(UserRole.STUDENT, 'notification:batch-ended', {
      isActive: false,
    });
  }

  async isWindowActive(): Promise<boolean> {
    const active = await this.redisService.get(this.REDIS_KEY);
    return active === 'true';
  }

  async getBatchStatus() {
    const now = new Date();
    const hour = now.getHours();
    const isActive = await this.isWindowActive();
    
    let windowInfo = {
      isActive,
      type: null as string | null,
      start: null as string | null,
      end: null as string | null,
      message: 'No active batch delivery window at the moment.',
    };

    if (hour >= 8 && hour < 10) {
      windowInfo.type = 'morning';
      windowInfo.start = '08:00';
      windowInfo.end = '10:00';
      if (isActive) windowInfo.message = 'Morning Batch Delivery is ACTIVE! 🚀 Plan your day and order now.';
    } else if (hour >= 14 && hour < 16) {
      windowInfo.type = 'afternoon';
      windowInfo.start = '14:00';
      windowInfo.end = '16:00';
      if (isActive) windowInfo.message = 'Afternoon Batch Delivery is LIVE! 📦 Get your lunch and snacks delivered quickly.';
    }

    return windowInfo;
  }
}
