import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { Order, OrderStatus } from '../orders/schemas/order.schema';
import { User } from '../users/schemas/user.schema';
import { Vendor } from '../vendors/schemas/vendor.schema';
import { SystemSetting } from '../admin/schemas/system-setting.schema';
import Zavudev from '@zavudev/sdk';
export interface NotificationPayload {
  title: string;
  body: string;
  type: string;
  data?: any;
  skipSms?: boolean;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private redisService: RedisService,
    private configService: ConfigService,
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Vendor.name) private vendorModel: Model<Vendor>,
    @InjectModel(SystemSetting.name) private readonly settingModel: Model<SystemSetting>,
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

    // Try to resolve FCM token and phone to send push/sms notification
    try {
      const user = await this.userModel.findById(userId).select('fcmToken phone');
      if (user) {
        if (user.fcmToken) {
          await this.sendPushNotification(user.fcmToken, enriched);
        }
        if (user.phone && !notification.skipSms) {
          await this.sendZavuSMS(user.phone, notification.body);
        }
        return;
      }
      const vendor = await this.vendorModel.findById(userId).select('fcmToken owner').populate('owner', 'phone');
      if (vendor) {
        if (vendor.fcmToken) {
          await this.sendPushNotification(vendor.fcmToken, enriched);
        }
        const ownerPhone = (vendor.owner as any)?.phone;
        if (ownerPhone && !notification.skipSms) {
          await this.sendZavuSMS(ownerPhone, notification.body);
        }
      }
    } catch (err) {
      this.logger.warn(`Failed to send push/sms notification to ${userId}: ${err.message}`);
    }
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
      const communicationsSetting = await this.settingModel.findOne({ key: 'communications' }).exec();
      const pushNotificationsEnabled = communicationsSetting?.value?.pushNotificationsEnabled ?? true;

      if (!pushNotificationsEnabled) {
        this.logger.warn(`Push notifications are globally disabled via admin settings. Skipping push to: ${fcmToken}`);
        return;
      }

      // FCM requires all data values to be strings
      const stringifiedData: Record<string, string> = {};
      if (payload.data) {
        for (const [key, value] of Object.entries(payload.data)) {
          if (value !== undefined && value !== null) {
            stringifiedData[key] = typeof value === 'string' ? value : String(value);
          }
        }
      }
      // Ensure 'type' is passed to data payload so SW can intercept it
      if (payload.type && !stringifiedData.type) {
        stringifiedData.type = payload.type;
      }

      await admin.messaging().send({
        token: fcmToken,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: stringifiedData,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'high_priority_orders',
          },
        },
        apns: {
          headers: {
            'apns-priority': '10',
          },
          payload: {
            aps: {
              sound: 'default',
            },
          },
        },
        webpush: {
          headers: {
            Urgency: 'high',
          },
          notification: {
            title: payload.title,
            body: payload.body,
            requireInteraction: true,
            icon: 'https://erranders.org/favicon.ico',
            badge: 'https://erranders.org/favicon.ico',
          },
          fcmOptions: {
            link: 'https://erranders.org',
          },
        },
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

  // ─── Zavu SMS ────────────────
  async sendZavuSMS(phone: string, text: string, options: { forceSms?: boolean } = { forceSms: false }) {
    if (!phone) return;
    
    // Sanitize message: strip emojis to keep standard GSM 160 char limit
    // Emoji regex to remove most common emoji characters and keep plain text
    const sanitizedText = text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}]/gu, '');
    
    let formattedPhone = phone.replace(/\+/g, '').replace(/\s+/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '+234' + formattedPhone.substring(1);
    } else if (formattedPhone.startsWith('234')) {
      formattedPhone = '+' + formattedPhone;
    } else {
      formattedPhone = '+234' + formattedPhone;
    }

    try {
      const apiKey = this.configService.get<string>('ZAVU_API_KEY');
      const senderId = this.configService.get<string>('ZAVU_SENDER_ID');
      
      if (!apiKey || !senderId) {
        this.logger.warn('ZAVU_API_KEY or ZAVU_SENDER_ID is not set in environment');
        return;
      }
      
      const zavu = new Zavudev({ apiKey });
      
      // Always send via SMS (Throttling/control is handled upstream via skipSms)
      const smsResponse = await zavu.messages.send({
        to: formattedPhone,
        text: sanitizedText,
        // @ts-ignore: senderId is required by the API but missing in TS types
        senderId,
        channel: 'sms_oneway'
      });
      this.logger.log(`Zavu SMS sent to ${formattedPhone}. Message ID: ${smsResponse.message?.id}`);
    } catch (error) {
      this.logger.error(`Zavu Message Failed to ${phone}: ${error.message}`);
    }
  }

  // ─── Urgent Support Notifications ────────────────
  async notifySupportTeam(message: string) {
    const supportContacts = [
      '+2348052854256', // Goodness
      '+2348139908262', // Ruth
      '+2348147626503'  // Marquis
    ];

    this.logger.log(`Notifying support team: ${message}`);
    for (const phone of supportContacts) {
      // Send urgent alerts via both WhatsApp and SMS to ensure delivery
      await this.sendZavuSMS(phone, `🚨 ERRANDERS URGENT: ${message}`, { forceSms: true });
    }
  }

  // ─── Cascade Orchestrator ────────────────
  async notifyVendor(vendor: any, order: any) {
    const title = '🚨 New Order on Erranders!';
    const body = `Order #${order.orderNumber} for ₦${(order.total || 0).toLocaleString()} has arrived. Please confirm now.`;
    
    // Safely extract owner userId — handles both populated (object) and unpopulated (ObjectId) cases
    const ownerId = (vendor.owner?._id || vendor.owner)?.toString();
    this.logger.log(`notifyVendor() ownerId=${ownerId}, vendorId=${vendor._id}, orderNumber=${order.orderNumber}`);
    
    if (!ownerId) {
      this.logger.error(`notifyVendor() FAILED: Could not extract owner ID from vendor ${vendor._id}`);
      return;
    }
    
    // 1. Send in-app Redis notification (Instant — routes to socket room user:<ownerId>)
    await this.sendNotification(ownerId, {
      title,
      body,
      type: 'NEW_ORDER',
      data: { orderId: order._id.toString() },
    });
    
    // 2. Send FCM Push (Instant) — try vendor FCM token first, then owner's user FCM token
    const fcmToken = vendor.fcmToken || vendor.owner?.fcmToken;
    if (fcmToken) {
      await this.sendPushNotification(fcmToken, { title, body, data: { orderId: order._id.toString() } });
    } else {
      this.logger.warn(`notifyVendor() No FCM token for vendor ${vendor._id} or owner ${ownerId}`);
    }

    // 3. Send Infobip SMS (Instant)
    const ownerPhone = vendor.owner?.phone;
    if (ownerPhone) {
      await this.sendZavuSMS(ownerPhone, body);
    }

    // 4. Wait 60s, check if confirmed. If not -> WhatsApp
    setTimeout(async () => {
      try {
        const checkOrder = await this.orderModel.findById(order._id);
        if (checkOrder && checkOrder.status === OrderStatus.PENDING) {
          if (ownerPhone) {
            await this.sendWhatsApp(ownerPhone, { body });
          }
        }
      } catch (e) {
        this.logger.error(`Cascade WhatsApp Check Failed: ${e.message}`);
      }
    }, 60000);

    // 5. Wait 90s, check if confirmed. If not -> Termii SMS (Fallback)
    setTimeout(async () => {
      try {
        const checkOrder = await this.orderModel.findById(order._id);
        if (checkOrder && checkOrder.status === OrderStatus.PENDING) {
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
    skipSms?: boolean
  ): Promise<void> {
    await this.sendNotification(vendorOwnerId, {
      title: '📦 Order Update',
      body: `Order #${orderData.orderNumber} is now ${status.replace(/_/g, ' ')}`,
      type: 'ORDER_STATUS_UPDATE',
      skipSms,
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
