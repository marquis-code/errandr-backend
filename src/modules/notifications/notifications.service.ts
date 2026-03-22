import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class NotificationsService {
  constructor(private redisService: RedisService) {}

  async sendNotification(
    userId: string,
    notification: {
      title: string;
      body: string;
      type: string;
      data?: any;
    },
  ): Promise<void> {
    // Store notification in Redis for retrieval
    const key = `notifications:${userId}`;
    const notifications = (await this.redisService.getJSON<any[]>(key)) || [];
    notifications.unshift({
      ...notification,
      id: Date.now().toString(),
      read: false,
      createdAt: new Date(),
    });
    // Keep last 50 notifications
    await this.redisService.setJSON(key, notifications.slice(0, 50), 604800); // 7 days

    // Publish for real-time delivery
    await this.redisService.publish(`notification:${userId}`, notification);
  }

  async getNotifications(userId: string): Promise<any[]> {
    return (await this.redisService.getJSON<any[]>(`notifications:${userId}`)) || [];
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    const key = `notifications:${userId}`;
    const notifications = (await this.redisService.getJSON<any[]>(key)) || [];
    const index = notifications.findIndex((n: any) => n.id === notificationId);
    if (index !== -1) {
      notifications[index].read = true;
      await this.redisService.setJSON(key, notifications, 604800);
    }
  }
}
