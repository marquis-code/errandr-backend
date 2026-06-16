import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { Order, OrderStatus } from '../orders/schemas/order.schema';

export interface NotificationPayload {
  title: string;
  body: string;
  type: string;
  data?: any;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private redisService: RedisService,
    private configService: ConfigService,
    @InjectModel(Order.name) private orderModel: Model<Order>,
  ) {}

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

  // ─── FCM Push ────────────────
  async sendPushNotification(fcmToken: string, payload: any) {
    if (!fcmToken) return;
    try {
      await admin.messaging().send({
        token: fcmToken,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data || {},
      });
      this.logger.log(`FCM Push sent to token: ${fcmToken}`);
    } catch (error) {
      this.logger.error(`FCM Push Failed: ${error.message}`);
    }
  }

  // ─── Termii WhatsApp ────────────────
  async sendWhatsApp(phone: string, templateData: any) {
    try {
      const apiKey = this.configService.get<string>('TERMII_API_KEY');
      if (!apiKey) {
        this.logger.warn('TERMII_API_KEY is not set');
        return;
      }
      const response = await fetch('https://api.ng.termii.com/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: phone,
          from: 'Erranders',
          sms: `New Order! ${templateData.body}`,
          type: 'plain',
          channel: 'whatsapp',
          api_key: apiKey,
        }),
      });
      const data = await response.json();
      this.logger.log(`WhatsApp sent to ${phone}: ${JSON.stringify(data)}`);
    } catch (error) {
      this.logger.error(`WhatsApp Failed: ${error.message}`);
    }
  }

  // ─── Termii SMS ────────────────
  async sendSMS(phone: string, text: string) {
    try {
      const apiKey = this.configService.get<string>('TERMII_API_KEY');
      if (!apiKey) {
        this.logger.warn('TERMII_API_KEY is not set');
        return;
      }
      const response = await fetch('https://api.ng.termii.com/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: phone,
          from: 'Erranders',
          sms: text,
          type: 'plain',
          channel: 'generic',
          api_key: apiKey,
        }),
      });
      const data = await response.json();
      this.logger.log(`SMS sent to ${phone}: ${JSON.stringify(data)}`);
    } catch (error) {
      this.logger.error(`SMS Failed: ${error.message}`);
    }
  }

  // ─── Cascade Orchestrator ────────────────
  async notifyVendor(vendor: any, order: any) {
    const title = '🚨 New Order on Erranders!';
    const body = `Order #${order.orderNumber} for ${order.total} NGN has arrived. Please confirm now.`;
    
    // 1. Send in-app Redis notification (Instant)
    await this.sendNotification(vendor.owner.toString(), {
      title,
      body,
      type: 'NEW_ORDER',
      data: { orderId: order._id.toString() },
    });
    
    // 2. Send FCM Push (Instant)
    if (vendor.fcmToken) {
      await this.sendPushNotification(vendor.fcmToken, { title, body, data: { orderId: order._id.toString() } });
    }

    // 3. Wait 60s, check if confirmed. If not -> WhatsApp
    setTimeout(async () => {
      try {
        const checkOrder = await this.orderModel.findById(order._id);
        if (checkOrder && checkOrder.status === OrderStatus.PENDING) {
          const ownerPhone = vendor.owner?.phone;
          if (ownerPhone) {
            await this.sendWhatsApp(ownerPhone, { body });
          }
        }
      } catch (e) {
        this.logger.error(`Cascade WhatsApp Check Failed: ${e.message}`);
      }
    }, 60000);

    // 4. Wait 90s, check if confirmed. If not -> SMS
    setTimeout(async () => {
      try {
        const checkOrder = await this.orderModel.findById(order._id);
        if (checkOrder && checkOrder.status === OrderStatus.PENDING) {
          const ownerPhone = vendor.owner?.phone;
          if (ownerPhone) {
            await this.sendSMS(ownerPhone, body);
          }
        }
      } catch (e) {
        this.logger.error(`Cascade SMS Check Failed: ${e.message}`);
      }
    }, 150000); // 60s + 90s = 150000ms
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
