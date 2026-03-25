import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

export interface NotificationPayload {
  title: string;
  body: string;
  type: string;
  data?: any;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private redisService: RedisService) {}

  /**
   * Send a notification to a specific user.
   * Stores in Redis + publishes for real-time delivery via gateway.
   */
  async sendNotification(
    userId: string,
    notification: NotificationPayload,
  ): Promise<void> {
    const enriched = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      read: false,
      createdAt: new Date().toISOString(),
    };

    // Store in Redis
    const key = `notifications:${userId}`;
    const notifications = (await this.redisService.getJSON<any[]>(key)) || [];
    notifications.unshift(enriched);
    await this.redisService.setJSON(key, notifications.slice(0, 100), 604800); // 7 days, max 100

    // Publish for real-time delivery
    await this.redisService.publish(`notification:${userId}`, enriched);
    this.logger.log(`Notification sent to ${userId}: ${notification.type}`);
  }

  /**
   * Broadcast a new order notification to ALL connected erranders.
   * Also stores a copy for each known errander (optional — we skip this for scalability).
   */
  async broadcastNewOrder(orderData: any): Promise<void> {
    const payload = {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: '🚀 New Order Available!',
      body: `Order #${orderData.orderNumber} from ${orderData.vendorName || 'a store'} — ₦${orderData.deliveryFee || 0} delivery fee`,
      type: 'NEW_ORDER_AVAILABLE',
      data: orderData,
      read: false,
      createdAt: new Date().toISOString(),
    };

    // Publish to broadcast channel — gateway will emit to all connected clients
    await this.redisService.publish('notification:broadcast:erranders', payload);
    this.logger.log(`Broadcasted new order ${orderData.orderNumber} to all erranders`);
  }

  /**
   * Notify a customer that their order was accepted by an errander.
   */
  async sendOrderAccepted(
    customerId: string,
    orderData: any,
    erranderDetails: any,
  ): Promise<void> {
    await this.sendNotification(customerId, {
      title: '✅ Order Accepted!',
      body: `${erranderDetails.firstName || 'A rider'} has accepted your order #${orderData.orderNumber} and is on the way!`,
      type: 'ORDER_ACCEPTED',
      data: {
        orderId: orderData._id || orderData.id,
        orderNumber: orderData.orderNumber,
        errander: {
          id: erranderDetails._id || erranderDetails.id,
          firstName: erranderDetails.firstName,
          lastName: erranderDetails.lastName,
          phone: erranderDetails.phone,
          avatar: erranderDetails.avatar,
        },
      },
    });
  }

  /**
   * Notify vendor that an order status changed (e.g., picked up, delivered).
   */
  async sendOrderStatusToVendor(
    vendorOwnerId: string,
    orderData: any,
    status: string,
  ): Promise<void> {
    await this.sendNotification(vendorOwnerId, {
      title: '📦 Order Update',
      body: `Order #${orderData.orderNumber} is now ${status.replace(/_/g, ' ')}`,
      type: 'ORDER_STATUS_UPDATE',
      data: {
        orderId: orderData._id || orderData.id,
        orderNumber: orderData.orderNumber,
        status,
      },
    });
  }

  /**
   * Get all stored notifications for a user.
   */
  async getNotifications(userId: string): Promise<any[]> {
    return (await this.redisService.getJSON<any[]>(`notifications:${userId}`)) || [];
  }

  /**
   * Mark a specific notification as read.
   */
  async markAsRead(userId: string, notificationId: string): Promise<void> {
    const key = `notifications:${userId}`;
    const notifications = (await this.redisService.getJSON<any[]>(key)) || [];
    const index = notifications.findIndex((n: any) => n.id === notificationId);
    if (index !== -1) {
      notifications[index].read = true;
      await this.redisService.setJSON(key, notifications, 604800);
    }
  }

  /**
   * Mark all notifications as read for a user.
   */
  async markAllAsRead(userId: string): Promise<void> {
    const key = `notifications:${userId}`;
    const notifications = (await this.redisService.getJSON<any[]>(key)) || [];
    notifications.forEach((n: any) => { n.read = true; });
    await this.redisService.setJSON(key, notifications, 604800);
  }

  /**
   * Get unread count for a user.
   */
  async getUnreadCount(userId: string): Promise<number> {
    const notifications = await this.getNotifications(userId);
    return notifications.filter((n: any) => !n.read).length;
  }
}
