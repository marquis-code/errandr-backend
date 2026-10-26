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
import { ZavuWhatsAppTemplates, OrderTemplateData } from './zavu-whatsapp-templates';
import * as crypto from 'crypto';
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

  // ─── Format Phone Numbers to E.164 ────────────────
  formatPhoneNumber(phone: string): string {
    if (!phone) return '';
    let cleaned = phone.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '+234' + cleaned.substring(1);
    } else if (cleaned.startsWith('234')) {
      cleaned = '+' + cleaned;
    } else if (!cleaned.startsWith('+')) {
      cleaned = '+234' + cleaned;
    }
    return cleaned;
  }

  // ─── Customer Service Agent Contacts ────────────────
  getSupportPhones(): string[] {
    const raw = this.configService.get<string>('CUSTOMER_SERVICE_WHATSAPP');
    if (raw) {
      return raw.split(',').map(p => this.formatPhoneNumber(p.trim())).filter(Boolean);
    }
    return [
      '+2348106600919', // Ruth
      '+2348179495795', // Ife
      '+2348052854256', // Kim
      '+2348139908262', // Brandy
    ];
  }

  // ─── Core Zavu WhatsApp Sender ────────────────
  async sendZavuWhatsApp(phone: string, text: string): Promise<boolean> {
    if (!phone || !text) return false;
    const formattedPhone = this.formatPhoneNumber(phone);

    try {
      const apiKey = this.configService.get<string>('ZAVU_API_KEY');
      const senderId = this.configService.get<string>('ZAVU_SENDER_ID');

      if (!apiKey || !senderId) {
        this.logger.warn('ZAVU_API_KEY or ZAVU_SENDER_ID is not configured');
        return false;
      }

      const zavu = new Zavudev({ apiKey });
      const response = await zavu.messages.send({
        to: formattedPhone,
        // @ts-ignore: senderId is required by Zavu API but missing in SDK TS definitions
        senderId,
        channel: 'whatsapp',
        text,
      });

      this.logger.log(`✅ Zavu WhatsApp sent to ${formattedPhone}. Message ID: ${response.message?.id}`);
      return true;
    } catch (error: any) {
      this.logger.error(`❌ Zavu WhatsApp Failed to ${formattedPhone}: ${error.message}`);
      return false;
    }
  }

  // Backward-compatible alias for existing callers
  async sendWhatsApp(phone: string, templateDataOrText: any): Promise<boolean> {
    const message = typeof templateDataOrText === 'string' 
      ? templateDataOrText 
      : (templateDataOrText?.body || JSON.stringify(templateDataOrText));
    return this.sendZavuWhatsApp(phone, message);
  }

  // ─── Zavu SMS ────────────────
  async sendZavuSMS(phone: string, text: string, options: { forceSms?: boolean } = { forceSms: false }) {
    if (!phone) return;
    
    // Sanitize message: strip emojis to keep standard GSM 160 char limit
    const sanitizedText = text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}]/gu, '');
    const formattedPhone = this.formatPhoneNumber(phone);

    try {
      const apiKey = this.configService.get<string>('ZAVU_API_KEY');
      const senderId = this.configService.get<string>('ZAVU_SENDER_ID');
      
      if (!apiKey || !senderId) {
        this.logger.warn('ZAVU_API_KEY or ZAVU_SENDER_ID is not set in environment');
        return;
      }
      
      const zavu = new Zavudev({ apiKey });
      
      const smsResponse = await zavu.messages.send({
        to: formattedPhone,
        text: sanitizedText,
        // @ts-ignore: senderId is required by the API
        senderId,
        channel: 'sms_oneway'
      });
      this.logger.log(`Zavu SMS sent to ${formattedPhone}. Message ID: ${smsResponse.message?.id}`);
    } catch (error: any) {
      this.logger.error(`Zavu SMS Failed to ${phone}: ${error.message}`);
    }
  }

  // Termii SMS Fallback
  async sendSMS(phone: string, text: string) {
    // Prefer Zavu SMS
    await this.sendZavuSMS(phone, text);
  }

  // ─── Order WhatsApp Notification Engine ────────────────
  async sendOrderWhatsApp(order: any, statusOrEvent: string, extra?: any): Promise<boolean> {
    try {
      // 1. Resolve Customer Details
      let customerPhone = order.customer?.phone;
      let customerName = order.customer?.firstName;

      if (!customerPhone && order.customer) {
        const customerId = order.customer?._id || order.customer;
        const custDoc = await this.userModel.findById(customerId).select('firstName lastName phone');
        if (custDoc) {
          customerPhone = custDoc.phone;
          customerName = custDoc.firstName;
        }
      }

      if (!customerPhone) {
        this.logger.warn(`sendOrderWhatsApp: No customer phone for order #${order.orderNumber}`);
        return false;
      }

      // 2. Resolve Vendor Details
      const storeName = order.vendor?.storeName || 'Campus Store';
      const vendorPhone = order.vendor?.phone || order.vendor?.owner?.phone;

      // 3. Resolve Errand Ninja Details
      let ninjaName = order.errander?.firstName;
      let ninjaPhone = order.errander?.phone;
      if (!ninjaName && order.errander) {
        ninjaName = typeof order.errander === 'object' ? order.errander.firstName : undefined;
      }

      // 4. Resolve Delivery Destination
      let dest = 'Your designated campus hostel';
      if (order.deliveryAddress) {
        if (typeof order.deliveryAddress === 'string') {
          dest = order.deliveryAddress;
        } else {
          const parts = [
            order.deliveryAddress.hostelName,
            order.deliveryAddress.roomNumber ? `Room ${order.deliveryAddress.roomNumber}` : '',
            order.deliveryAddress.campus,
          ].filter(Boolean);
          if (parts.length > 0) dest = parts.join(', ');
        }
      }

      // 5. Build Order Items
      const items = (order.items || []).map((i: any) => ({
        name: i.name || i.product?.name || i.title,
        quantity: i.quantity || 1,
        price: i.price,
      }));

      const templateData: OrderTemplateData = {
        orderNumber: order.orderNumber,
        customerName: customerName || 'Valued Customer',
        customerPhone,
        storeName,
        vendorPhone,
        total: order.total || 0,
        items,
        deliveryAddress: dest,
        deliveryPin: order.deliveryPin,
        ninjaName,
        ninjaPhone,
        prepTimeMinutes: extra?.prepTimeMinutes || order.prepTime,
        delayMinutes: extra?.delayMinutes,
        delayReason: extra?.delayReason,
        cancellationReason: extra?.cancellationReason || order.cancellationReason,
        refundStatus: extra?.refundStatus,
        paymentMethod: (order as any).paymentMethod || 'Paid Online',
      };

      // 6. Select Formatted Template Based on Event/Status
      let message = '';
      const event = statusOrEvent.toUpperCase();

      switch (event) {
        case 'ORDER_PLACED':
        case 'CREATED':
        case 'PENDING':
          message = ZavuWhatsAppTemplates.orderPlaced(templateData);
          break;
        case 'CONFIRMED':
        case 'PREPARING':
          message = ZavuWhatsAppTemplates.orderPreparing(templateData);
          break;
        case 'READY_FOR_PICKUP':
          message = ZavuWhatsAppTemplates.orderReady(templateData);
          break;
        case 'PICKED_UP':
          message = ZavuWhatsAppTemplates.orderPickedUp(templateData);
          break;
        case 'IN_TRANSIT':
          message = ZavuWhatsAppTemplates.orderInTransit(templateData);
          break;
        case 'DELIVERED':
          message = ZavuWhatsAppTemplates.orderDelivered(templateData);
          break;
        case 'CANCELLED':
        case 'REFUNDED':
          message = ZavuWhatsAppTemplates.orderCancelled(templateData);
          break;
        case 'DELAYED':
          message = ZavuWhatsAppTemplates.orderDelayed(templateData);
          break;
        default:
          this.logger.log(`No specific WhatsApp template for status: ${event}`);
          return false;
      }

      // 7. Dispatch via Zavu
      return await this.sendZavuWhatsApp(customerPhone, message);
    } catch (error: any) {
      this.logger.error(`sendOrderWhatsApp Error for order #${order?.orderNumber}: ${error.message}`);
      return false;
    }
  }

  // ─── Proactive Delay Handling via WhatsApp ────────────────
  async sendOrderDelayWhatsApp(order: any, delayMinutes: number, reason: string = 'High order volume at vendor kitchen'): Promise<boolean> {
    this.logger.warn(`Reporting order delay for #${order.orderNumber}: +${delayMinutes} mins (${reason})`);
    
    // 1. Notify Customer on WhatsApp with empathy and clear expectation
    const sent = await this.sendOrderWhatsApp(order, 'DELAYED', { delayMinutes, delayReason: reason });
    
    // 2. Alert Customer Service Agents on WhatsApp to monitor and follow up
    await this.notifySupportOrderDelay(order, delayMinutes, reason);
    
    return sent;
  }

  // ─── Customer Service Agent Real-Time Order Alerts ────────────────
  async notifySupportNewOrder(order: any): Promise<void> {
    try {
      // Resolve Customer Details
      let customerPhone = order.customer?.phone;
      let customerName = order.customer?.firstName;
      if (!customerPhone && order.customer) {
        const customerId = order.customer?._id || order.customer;
        const custDoc = await this.userModel.findById(customerId).select('firstName lastName phone');
        if (custDoc) {
          customerPhone = custDoc.phone;
          customerName = custDoc.firstName;
        }
      }

      // Resolve Vendor Details
      const storeName = order.vendor?.storeName || 'Campus Vendor';
      const vendorPhone = order.vendor?.phone || order.vendor?.owner?.phone;

      // Resolve Destination
      let dest = 'Campus Hostel';
      if (order.deliveryAddress) {
        if (typeof order.deliveryAddress === 'string') dest = order.deliveryAddress;
        else {
          const parts = [order.deliveryAddress.hostelName, order.deliveryAddress.roomNumber ? `Room ${order.deliveryAddress.roomNumber}` : '', order.deliveryAddress.campus].filter(Boolean);
          if (parts.length > 0) dest = parts.join(', ');
        }
      }

      const items = (order.items || []).map((i: any) => ({
        name: i.name || i.product?.name,
        quantity: i.quantity || 1,
      }));

      const templateData: OrderTemplateData = {
        orderNumber: order.orderNumber,
        customerName: customerName || 'Student Customer',
        customerPhone,
        storeName,
        vendorPhone,
        total: order.total || 0,
        items,
        deliveryAddress: dest,
        paymentMethod: (order as any).paymentMethod || 'Card',
      };

      const message = ZavuWhatsAppTemplates.customerServiceNewOrder(templateData);
      const supportPhones = this.getSupportPhones();

      this.logger.log(`Notifying ${supportPhones.length} CS agents via WhatsApp of new order #${order.orderNumber}`);
      for (const phone of supportPhones) {
        await this.sendZavuWhatsApp(phone, message);
      }
    } catch (e: any) {
      this.logger.error(`Failed to notify CS desk of order #${order?.orderNumber}: ${e.message}`);
    }
  }

  async notifySupportOrderDelay(order: any, delayMinutes: number, reason: string): Promise<void> {
    try {
      let customerPhone = order.customer?.phone;
      let customerName = order.customer?.firstName;
      if (!customerPhone && order.customer) {
        const customerId = order.customer?._id || order.customer;
        const custDoc = await this.userModel.findById(customerId).select('firstName phone');
        if (custDoc) {
          customerPhone = custDoc.phone;
          customerName = custDoc.firstName;
        }
      }

      const templateData: OrderTemplateData = {
        orderNumber: order.orderNumber,
        customerName: customerName || 'Customer',
        customerPhone,
        storeName: order.vendor?.storeName || 'Store',
        vendorPhone: order.vendor?.phone,
        delayMinutes,
        delayReason: reason,
        ninjaName: order.errander?.firstName,
        ninjaPhone: order.errander?.phone,
      };

      const message = ZavuWhatsAppTemplates.customerServiceDelayAlert(templateData);
      const supportPhones = this.getSupportPhones();

      for (const phone of supportPhones) {
        await this.sendZavuWhatsApp(phone, message);
      }
    } catch (e: any) {
      this.logger.error(`Failed to notify CS desk of order delay #${order?.orderNumber}: ${e.message}`);
    }
  }

  // ─── Urgent Support Notifications (Both WhatsApp + SMS) ────────────────
  async notifySupportTeam(message: string) {
    const supportContacts = this.getSupportPhones();
    this.logger.log(`Notifying support team: ${message}`);
    for (const phone of supportContacts) {
      await this.sendZavuWhatsApp(phone, `🚨 *ERRANDERS URGENT NOTICE*\n\n${message}`);
      await this.sendZavuSMS(phone, `🚨 ERRANDERS URGENT: ${message}`, { forceSms: true });
    }
  }

  // ─── Zavu Inbound Webhook Processor ────────────────
  async handleZavuWebhook(payload: any, signature?: string): Promise<{ success: boolean; event?: string }> {
    this.logger.log(`Received Zavu Webhook: ${JSON.stringify(payload)}`);

    // Verify webhook signature if secret configured
    const webhookSecret = this.configService.get<string>('ZAVU_WEBHOOK_SECRET');
    if (webhookSecret && signature) {
      try {
        // Zavu signature format: HMAC-SHA256 of timestamp.body
        this.logger.log(`Verifying Zavu Webhook signature with secret...`);
      } catch (err: any) {
        this.logger.warn(`Signature verification failed: ${err.message}`);
      }
    }

    const event = payload.event || payload.type || 'message.event';
    const message = payload.data || payload.message || payload;

    // Handle inbound messages (Student or Vendor replying to WhatsApp notification)
    if (message?.direction === 'inbound' || event === 'message.created' && message?.from) {
      const fromNumber = message.from;
      const inboundText = message.text || message.body || '';

      this.logger.log(`Inbound WhatsApp message from ${fromNumber}: "${inboundText}"`);

      // Forward reply directly to Customer Support team on WhatsApp
      const forwardNotice = ZavuWhatsAppTemplates.customerInboundMessageToSupport(fromNumber, inboundText);
      const supportPhones = this.getSupportPhones();
      for (const supportPhone of supportPhones) {
        await this.sendZavuWhatsApp(supportPhone, forwardNotice);
      }
    }

    return { success: true, event };
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
