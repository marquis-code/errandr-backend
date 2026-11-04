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
import { WhatsAppTemplates, OrderTemplateData, PayoutReceiptTemplateData } from './whatsapp-templates';
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
          await this.sendSMS(user.phone, notification.body);
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
          await this.sendSMS(ownerPhone, notification.body);
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

  // ─── Format Phone Numbers to E.164 (or Keep Group JIDs) ────────────────
  formatPhoneNumber(phone: string): string {
    if (!phone) return '';
    if (phone.includes('@g.us')) return phone.trim();
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

  // ─── Communications Settings Cache (15s TTL) ────────────────
  private commsSettingsCache: { data: any; expiry: number } | null = null;

  async getCommunicationsSettingsCached(): Promise<any> {
    const now = Date.now();
    if (this.commsSettingsCache && this.commsSettingsCache.expiry > now) {
      return this.commsSettingsCache.data;
    }
    try {
      const setting = await this.settingModel.findOne({ key: 'communications' }).lean().exec();
      const val = setting?.value || {};
      const merged = {
        emailsEnabled: val.emailsEnabled ?? true,
        pushNotificationsEnabled: val.pushNotificationsEnabled ?? true,
        whatsappEnabled: val.whatsappEnabled ?? true,
        whatsappVendorAlertsEnabled: val.whatsappVendorAlertsEnabled ?? true,
        whatsappCustomerMilestonesOnly: val.whatsappCustomerMilestonesOnly ?? true,
        whatsappNinjaBroadcastEnabled: val.whatsappNinjaBroadcastEnabled ?? false,
        whatsappNinjaGroupJid: val.whatsappNinjaGroupJid ?? '',
        whatsappNinjaBatchLimit: val.whatsappNinjaBatchLimit !== undefined ? Number(val.whatsappNinjaBatchLimit) : 4,
        whatsappSupportAlertsEnabled: val.whatsappSupportAlertsEnabled ?? true,
        whatsappSupportRecipientMode: val.whatsappSupportRecipientMode ?? 'single',
        whatsappSupportGroupJid: val.whatsappSupportGroupJid ?? '',
        whatsappThrottleDelaySeconds: val.whatsappThrottleDelaySeconds !== undefined ? Number(val.whatsappThrottleDelaySeconds) : 4,
        whatsappSimulateTyping: val.whatsappSimulateTyping ?? true,
      };
      this.commsSettingsCache = { data: merged, expiry: now + 15000 };
      return merged;
    } catch {
      return {
        emailsEnabled: true,
        pushNotificationsEnabled: true,
        whatsappEnabled: true,
        whatsappVendorAlertsEnabled: true,
        whatsappCustomerMilestonesOnly: true,
        whatsappNinjaBroadcastEnabled: false,
        whatsappNinjaGroupJid: '',
        whatsappNinjaBatchLimit: 4,
        whatsappSupportAlertsEnabled: true,
        whatsappSupportRecipientMode: 'single',
        whatsappSupportGroupJid: '',
        whatsappThrottleDelaySeconds: 4,
        whatsappSimulateTyping: true,
      };
    }
  }

  // ─── WhatsApp Anti-Ban Queue & Throttling System ────────────────
  private whatsAppQueue: Array<{
    phone: string;
    text: string;
    resolve: (sent: boolean) => void;
    isPriority?: boolean;
    createdAt: number;
  }> = [];
  private isProcessingWhatsAppQueue = false;
  private lastMessageTimestamps: Map<string, number> = new Map();

  /**
   * Enqueue a WhatsApp message to be dispatched with human-like pacing,
   * random jitter delay, deduplication, and presence simulation to prevent account bans.
   */
  async sendWhatsApp(phone: string, templateDataOrText: any, options?: { isPriority?: boolean }): Promise<boolean> {
    const text = typeof templateDataOrText === 'string'
      ? templateDataOrText
      : (templateDataOrText?.body || JSON.stringify(templateDataOrText));

    if (!phone || !text) return false;
    const formattedPhone = this.formatPhoneNumber(phone);

    // Global toggle check
    const comms = await this.getCommunicationsSettingsCached();
    if (comms?.whatsappEnabled === false) {
      this.logger.warn(`WhatsApp bot is globally disabled in communications settings. Skipping message to ${formattedPhone}`);
      return false;
    }

    // Deduplication check: prevent identical messages within 5 minutes to the same phone
    const textHash = crypto.createHash('md5').update(text.trim()).digest('hex').slice(0, 10);
    const dedupeKey = `notif:wa_dedupe:${formattedPhone}:${textHash}`;
    const isDup = await this.redisService.get(dedupeKey);
    if (isDup) {
      this.logger.log(`[Anti-Ban] Suppressed duplicate WhatsApp to ${formattedPhone} (identical message within 5 mins)`);
      return true;
    }
    await this.redisService.set(dedupeKey, '1', 300); // 5 min TTL

    return new Promise<boolean>((resolve) => {
      const item = {
        phone: formattedPhone,
        text,
        isPriority: options?.isPriority ?? false,
        resolve,
        createdAt: Date.now(),
      };

      if (options?.isPriority) {
        // Priority items (e.g. vendor order alerts) go to front of queue
        this.whatsAppQueue.unshift(item);
      } else {
        this.whatsAppQueue.push(item);
      }

      // Cap queue size at 150 to prevent memory leak under extreme load
      if (this.whatsAppQueue.length > 150) {
        const dropped = this.whatsAppQueue.pop();
        if (dropped) dropped.resolve(false);
      }

      // Kick off queue processor
      this.processWhatsAppQueue();
    });
  }

  private async processWhatsAppQueue() {
    if (this.isProcessingWhatsAppQueue) return;
    this.isProcessingWhatsAppQueue = true;

    while (this.whatsAppQueue.length > 0) {
      const item = this.whatsAppQueue.shift();
      if (!item) break;

      try {
        const comms = await this.getCommunicationsSettingsCached();
        if (comms?.whatsappEnabled === false) {
          item.resolve(false);
          continue;
        }

        // Anti-flood check for same recipient (unless priority)
        const lastSent = this.lastMessageTimestamps.get(item.phone) || 0;
        const timeSince = Date.now() - lastSent;
        const minRecipientGap = item.isPriority ? 1500 : 15000; // 15s between normal messages to same recipient
        if (timeSince < minRecipientGap) {
          const waitGap = minRecipientGap - timeSince;
          await new Promise((r) => setTimeout(r, waitGap));
        }

        // Presence simulation: send 'composing' typing status before text
        if (comms?.whatsappSimulateTyping !== false && !item.phone.includes('@g.us')) {
          await this.simulatePresence(item.phone, 'composing');
          const typingWait = 1200 + Math.floor(Math.random() * 800);
          await new Promise((r) => setTimeout(r, typingWait));
        }

        // Dispatch raw message to Evolution API
        const success = await this.dispatchEvolutionMessage(item.phone, item.text);
        this.lastMessageTimestamps.set(item.phone, Date.now());
        item.resolve(success);

        // Throttle gap between ANY consecutive outbound messages to protect account from spam heuristics
        const baseDelay = (comms?.whatsappThrottleDelaySeconds ?? 4) * 1000;
        const jitter = Math.floor(Math.random() * 2000); // 0-2s jitter
        const totalDelay = Math.max(2500, baseDelay + jitter);

        await new Promise((r) => setTimeout(r, totalDelay));
      } catch (err: any) {
        this.logger.error(`Error in WhatsApp queue worker: ${err.message}`);
        item.resolve(false);
      }
    }

    this.isProcessingWhatsAppQueue = false;
  }

  private async simulatePresence(phone: string, presence: string = 'composing'): Promise<void> {
    try {
      const evoUrl = this.configService.get<string>('WHATSAPP_EVOLUTION_API_URL')?.replace(/\/$/, '');
      const evoKey = this.configService.get<string>('WHATSAPP_EVOLUTION_API_KEY');
      const evoInstance = this.configService.get<string>('WHATSAPP_EVOLUTION_INSTANCE') || 'Erranders';
      if (!evoUrl || !evoKey) return;

      const digitsOnly = phone.replace(/\D/g, '');
      await fetch(`${evoUrl}/chat/sendPresence/${evoInstance}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: evoKey,
        },
        body: JSON.stringify({
          number: digitsOnly,
          presence,
          delay: 1200,
        }),
        signal: AbortSignal.timeout(5000),
      }).catch(() => {});
    } catch {
      // Presence simulation failure should never block message delivery
    }
  }

  private async dispatchEvolutionMessage(phone: string, text: string): Promise<boolean> {
    const evoUrl = this.configService.get<string>('WHATSAPP_EVOLUTION_API_URL')?.replace(/\/$/, '');
    const evoKey = this.configService.get<string>('WHATSAPP_EVOLUTION_API_KEY');
    const evoInstance = this.configService.get<string>('WHATSAPP_EVOLUTION_INSTANCE') || 'Erranders';

    if (!evoUrl || !evoKey) {
      this.logger.warn('WHATSAPP_EVOLUTION_API_URL or WHATSAPP_EVOLUTION_API_KEY is not configured');
      return false;
    }

    try {
      const isGroup = phone.includes('@g.us');
      const targetNumber = isGroup ? phone : phone.replace(/\D/g, '');

      const response = await fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: evoKey,
        },
        body: JSON.stringify({
          number: targetNumber,
          text,
        }),
        signal: AbortSignal.timeout(15000),
      });

      const data = (await response.json().catch(() => ({}))) as any;
      if (!response.ok) {
        throw new Error(data?.message || data?.error || `Evolution API ${response.status}`);
      }

      const msgId = data?.key?.id || data?.id || 'ok';
      this.logger.log(`✅ WhatsApp sent to ${targetNumber}. Message ID: ${msgId}`);
      return true;
    } catch (error: any) {
      this.logger.error(`❌ WhatsApp Failed to ${phone}: ${error.message}`);
      return false;
    }
  }

  // ─── SMS Sender (Termii with Infobip Fallback) ────────────────
  async sendSMS(phone: string, text: string, options: { forceSms?: boolean } = { forceSms: false }): Promise<boolean> {
    if (!phone || !text) return false;

    // Sanitize message: strip emojis to keep standard GSM 160 char limit
    const sanitizedText = text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}]/gu, '');
    const formattedPhone = this.formatPhoneNumber(phone);
    const digitsOnly = formattedPhone.replace(/\D/g, '');

    // 1. Try Termii first if configured
    const termiiKey = this.configService.get<string>('TERMII_API_KEY');
    if (termiiKey) {
      try {
        const response = await fetch('https://api.ng.termii.com/api/sms/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: digitsOnly,
            from: 'Erranders',
            sms: sanitizedText,
            type: 'plain',
            channel: 'generic',
            api_key: termiiKey,
          }),
          signal: AbortSignal.timeout(10000),
        });

        const resData = (await response.json().catch(() => ({}))) as any;
        if (response.ok && (resData?.code === 'ok' || resData?.message?.includes('Successfully'))) {
          this.logger.log(`✅ Termii SMS sent to ${digitsOnly}. Message ID: ${resData?.message_id || 'ok'}`);
          return true;
        }
        this.logger.warn(`Termii SMS response: ${JSON.stringify(resData)}`);
      } catch (err: any) {
        this.logger.warn(`Termii SMS error for ${digitsOnly}: ${err.message}`);
      }
    }

    // 2. Try Infobip fallback if configured
    const infobipKey = this.configService.get<string>('INFOBIP_API_KEY');
    const infobipBase = this.configService.get<string>('INFOBIP_BASE_URL')?.replace(/\/$/, '');
    const infobipSender = this.configService.get<string>('INFOBIP_SENDER') || '447491163443';

    if (infobipKey && infobipBase) {
      try {
        const authHeader = infobipKey.startsWith('App ') ? infobipKey : `App ${infobipKey}`;
        const response = await fetch(`${infobipBase}/sms/2/text/advanced`, {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              {
                destinations: [{ to: formattedPhone }],
                from: infobipSender,
                text: sanitizedText,
              },
            ],
          }),
          signal: AbortSignal.timeout(10000),
        });

        const resData = (await response.json().catch(() => ({}))) as any;
        if (response.ok) {
          this.logger.log(`✅ Infobip SMS sent to ${formattedPhone}`);
          return true;
        }
        this.logger.warn(`Infobip SMS response: ${JSON.stringify(resData)}`);
      } catch (err: any) {
        this.logger.error(`Infobip SMS error for ${formattedPhone}: ${err.message}`);
      }
    }

    this.logger.warn(`No SMS provider succeeded for ${phone}`);
    return false;
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
      let storeName = order.vendor?.storeName || 'Campus Store';
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

      if (order.type === 'custom_errand') {
        storeName = order.customDetails?.pickupLocation || storeName || 'Custom Pickup Location';
        if (order.customDetails?.dropoffLocation) {
          dest = order.customDetails.dropoffLocation;
        }
      }

      // 5. Build Order Items
      const items = (order.items || []).map((i: any) => ({
        name: i.name || i.product?.name || i.title,
        quantity: i.quantity || 1,
        price: i.price,
      }));

      if (items.length === 0 && order.customDetails?.description) {
        items.push({
          name: order.customDetails.description,
          quantity: 1,
          price: order.customDetails.estimatedItemCost || order.total,
        });
      }

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

      // Anti-ban check: Verify if global WhatsApp or milestone mode is configured
      const comms = await this.getCommunicationsSettingsCached();
      if (comms?.whatsappEnabled === false) {
        return false;
      }

      if (comms?.whatsappCustomerMilestonesOnly !== false) {
        // Milestone Mode: Suppress intermediate kitchen micro-statuses to protect account from spam bans
        if (['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP'].includes(event)) {
          this.logger.log(`[Anti-Ban] Suppressed customer WhatsApp for status "${event}" on order #${order.orderNumber} (Milestone-only mode active)`);
          return true;
        }
      }

      switch (event) {
        case 'CUSTOM_ERRAND_RECEIVED':
          message = WhatsAppTemplates.customErrandReceived(templateData);
          break;
        case 'ORDER_PLACED':
        case 'CREATED':
        case 'PENDING':
          message = order.type === 'custom_errand'
            ? WhatsAppTemplates.customErrandReceived(templateData)
            : WhatsAppTemplates.orderPlaced(templateData);
          break;
        case 'CONFIRMED':
        case 'PREPARING':
          message = WhatsAppTemplates.orderPreparing(templateData);
          break;
        case 'READY_FOR_PICKUP':
          message = WhatsAppTemplates.orderReady(templateData);
          break;
        case 'PICKED_UP':
          message = WhatsAppTemplates.orderPickedUp(templateData);
          break;
        case 'IN_TRANSIT':
          message = WhatsAppTemplates.orderInTransit(templateData);
          break;
        case 'DELIVERED':
          message = WhatsAppTemplates.orderDelivered(templateData);
          break;
        case 'CANCELLED':
        case 'REFUNDED':
          message = WhatsAppTemplates.orderCancelled(templateData);
          break;
        case 'DELAYED':
          message = WhatsAppTemplates.orderDelayed(templateData);
          break;
        default:
          this.logger.log(`No specific WhatsApp template for status: ${event}`);
          return false;
      }

      // 7. Dispatch via WhatsApp (Evolution API)
      return await this.sendWhatsApp(customerPhone, message);
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
      const orderKey = order._id?.toString() || order.orderNumber;
      if (!orderKey) return;

      // ─── Deduplication Guard: Never notify CS twice for the same order ───
      const dedupeKey = `notif:cs_new_order:${orderKey}`;
      const alreadySent = await this.redisService.get(dedupeKey);
      if (alreadySent) {
        this.logger.log(`CS Desk alert already dispatched for order #${order.orderNumber}, skipping duplicate.`);
        return;
      }
      await this.redisService.set(dedupeKey, 'sent', 86400); // 24-hour TTL

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
      let storeName = order.vendor?.storeName;
      let vendorPhone = order.vendor?.phone || order.vendor?.owner?.phone;
      if ((!storeName || !vendorPhone) && order.vendor) {
        try {
          const vendorId = order.vendor?._id || order.vendor;
          const vendDoc = await this.vendorModel.findById(vendorId).populate('owner', 'phone');
          if (vendDoc) {
            storeName = storeName || vendDoc.storeName;
            vendorPhone = vendorPhone || vendDoc.phone || (vendDoc.owner as any)?.phone;
          }
        } catch (e: any) {
          this.logger.warn(`Failed to resolve vendor for CS notification: ${e.message}`);
        }
      }
      storeName = storeName || 'Campus Vendor';

      // Resolve Destination
      let dest = 'Campus Hostel';
      if (order.deliveryAddress) {
        if (typeof order.deliveryAddress === 'string') dest = order.deliveryAddress;
        else {
          const parts = [order.deliveryAddress.hostelName, order.deliveryAddress.roomNumber ? `Room ${order.deliveryAddress.roomNumber}` : '', order.deliveryAddress.campus].filter(Boolean);
          if (parts.length > 0) dest = parts.join(', ');
        }
      }

      if (order.type === 'custom_errand') {
        storeName = order.customDetails?.pickupLocation || storeName || 'Custom Pickup Location';
        if (order.customDetails?.dropoffLocation) {
          dest = order.customDetails.dropoffLocation;
        }
      }

      const items = (order.items || []).map((i: any) => ({
        name: i.name || i.product?.name,
        quantity: i.quantity || 1,
      }));

      if (items.length === 0 && order.customDetails?.description) {
        items.push({
          name: order.customDetails.description,
          quantity: 1,
        });
      }

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

      const comms = await this.getCommunicationsSettingsCached();
      if (comms?.whatsappEnabled === false || comms?.whatsappSupportAlertsEnabled === false) {
        return;
      }

      const message = WhatsAppTemplates.customerServiceNewOrder(templateData);

      // Check if a dedicated WhatsApp group JID is configured for CS desk
      if (comms?.whatsappSupportGroupJid) {
        this.logger.log(`Notifying CS Desk via WhatsApp Group ${comms.whatsappSupportGroupJid} for order #${order.orderNumber}`);
        await this.sendWhatsApp(comms.whatsappSupportGroupJid, message);
        return;
      }

      const supportPhones = this.getSupportPhones();
      const mode = comms?.whatsappSupportRecipientMode || 'single';

      if (mode === 'single' && supportPhones.length > 0) {
        this.logger.log(`Notifying primary CS agent ${supportPhones[0]} via WhatsApp for order #${order.orderNumber}`);
        await this.sendWhatsApp(supportPhones[0], message);
      } else {
        this.logger.log(`Notifying ${supportPhones.length} CS agents via WhatsApp of new order #${order.orderNumber}`);
        for (const phone of supportPhones) {
          await this.sendWhatsApp(phone, message);
        }
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

      const message = WhatsAppTemplates.customerServiceDelayAlert(templateData);
      const supportPhones = this.getSupportPhones();

      for (const phone of supportPhones) {
        await this.sendWhatsApp(phone, message);
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
      await this.sendWhatsApp(phone, `🚨 *Erranders Bot* · urgent notice\n\n${message}\n\n— Erranders Bot`);
      await this.sendSMS(phone, `🚨 Erranders Bot: ${message}`, { forceSms: true });
    }
  }

  // ─── Errand Ninja WhatsApp Notifications ────────────────
  async notifyNinjaNewErrand(phone: string, data: { storeName: string; orderNumber: string; deliveryFee: number; variantIndex?: number }): Promise<boolean> {
    try {
      const comms = await this.getCommunicationsSettingsCached();
      if (comms?.whatsappEnabled === false || comms?.whatsappNinjaBroadcastEnabled !== true) {
        // Ninja broadcast is disabled by default to prevent mass-messaging WhatsApp account suspensions
        return true;
      }
      const message = WhatsAppTemplates.errandAvailableForNinja(data);
      return await this.sendWhatsApp(phone, message);
    } catch (e: any) {
      this.logger.warn(`Failed to send new errand WhatsApp to Ninja ${phone}: ${e.message}`);
      return false;
    }
  }

  async notifyNinjaOrderAssigned(phone: string, data: { ninjaName?: string; orderNumber: string; storeName: string; deliveryAddress: string; deliveryFee: number; itemsCount?: number }): Promise<boolean> {
    try {
      const message = WhatsAppTemplates.orderAssignedToNinja(data);
      return await this.sendWhatsApp(phone, message);
    } catch (e: any) {
      this.logger.warn(`Failed to send order assigned WhatsApp to Ninja ${phone}: ${e.message}`);
      return false;
    }
  }

  async sendPayoutReceipt(phone: string, data: PayoutReceiptTemplateData): Promise<boolean> {
    try {
      const message = WhatsAppTemplates.payoutReceipt(data);
      return await this.sendWhatsApp(phone, message, { isPriority: true });
    } catch (e: any) {
      this.logger.error(`Failed to send WhatsApp payout receipt to ${phone}: ${e.message}`);
      return false;
    }
  }

  // ─── Evolution API Inbound Webhook Processor ────────────────
  async handleEvolutionWebhook(payload: any, headers?: any): Promise<{ success: boolean; event?: string }> {
    this.logger.log(`Received Evolution Webhook: ${JSON.stringify(payload)}`);

    const event = String(payload?.event || payload?.type || '').toLowerCase().replace(/_/g, '.');

    if (event === 'messages.upsert') {
      const data = payload?.data;
      const items = Array.isArray(data) ? data : data ? [data] : [];

      for (const item of items) {
        const key = item?.key;
        if (!key || key.fromMe === true) continue; // Skip messages sent by our bot

        const remoteJid = String(key.remoteJid || '');
        if (!remoteJid || remoteJid.endsWith('@g.us') || remoteJid.includes('status@broadcast')) {
          continue; // Skip group messages and broadcasts
        }

        const fromNumber = remoteJid.replace(/@.*$/, '');
        const messageObj = item?.message;
        const inboundText = String(
          messageObj?.conversation ||
          messageObj?.extendedTextMessage?.text ||
          messageObj?.imageMessage?.caption ||
          messageObj?.videoMessage?.caption ||
          messageObj?.buttonsResponseMessage?.selectedDisplayText ||
          '',
        ).trim();

        if (fromNumber && inboundText) {
          this.logger.log(`Inbound Evolution WhatsApp from ${fromNumber}: "${inboundText}"`);

          // Special VIP recognition for Marquis's girlfriend (+234 705 718 8970)
          const normalized = fromNumber.replace(/\D/g, '');
          if (normalized.endsWith('7057188970')) {
            const girlfriendLoveReply = `Hey gorgeous! ❤️ Always a joy hearing from you. Marquis asked me to take extra special care of you! 🥰✨ You're our #1 VIP. Marquis sends you all his love! 💕`;
            await this.sendWhatsApp(fromNumber, girlfriendLoveReply);
          }

          // Forward customer/vendor reply directly to Customer Support team on WhatsApp
          const comms = await this.getCommunicationsSettingsCached();
          if (comms?.whatsappSupportAlertsEnabled !== false) {
            const forwardNotice = WhatsAppTemplates.customerInboundMessageToSupport(fromNumber, inboundText);
            if (comms?.whatsappSupportGroupJid) {
              await this.sendWhatsApp(comms.whatsappSupportGroupJid, forwardNotice);
            } else {
              const supportPhones = this.getSupportPhones();
              const mode = comms?.whatsappSupportRecipientMode || 'single';
              if (mode === 'single' && supportPhones.length > 0) {
                await this.sendWhatsApp(supportPhones[0], forwardNotice);
              } else {
                for (const supportPhone of supportPhones) {
                  await this.sendWhatsApp(supportPhone, forwardNotice);
                }
              }
            }
          }
        }
      }
    }

    return { success: true, event };
  }


  // ─── Guaranteed Vendor Notification Orchestrator ────────────────
  async notifyVendor(vendorInput: any, order: any) {
    try {
      if (!order) return;
      const orderId = order._id?.toString() || order.id?.toString();
      const orderNumber = order.orderNumber || String(orderId || '').slice(-6);

      // Deduplication guard: Never notify the same vendor twice for the same order
      if (orderId) {
        const dedupeKey = `notif:vendor_new_order:${orderId}`;
        const alreadySent = await this.redisService.get(dedupeKey);
        if (alreadySent) {
          this.logger.log(`Vendor already notified for order #${orderNumber}, skipping duplicate.`);
          return;
        }
        await this.redisService.set(dedupeKey, 'sent', 86400); // 24-hr TTL
      }

      // 1. Fully resolve Vendor document & Owner User document
      let vendorDoc: any = vendorInput;
      const vendorId = vendorInput?._id || vendorInput;

      if (!vendorDoc?.storeName || !vendorDoc?.owner?.phone) {
        if (vendorId) {
          try {
            vendorDoc = await this.vendorModel.findById(vendorId).populate('owner').exec();
          } catch (e: any) {
            this.logger.warn(`Could not populate vendor by ID ${vendorId}: ${e.message}`);
          }
        }
      }

      if (!vendorDoc && order.vendor) {
        const orderVendorId = order.vendor?._id || order.vendor;
        try {
          vendorDoc = await this.vendorModel.findById(orderVendorId).populate('owner').exec();
        } catch (e: any) {
          this.logger.warn(`Could not resolve order vendor ${orderVendorId}: ${e.message}`);
        }
      }

      if (!vendorDoc) {
        this.logger.error(`notifyVendor() FAILED: Could not resolve vendor for order #${orderNumber}`);
        return;
      }

      // If owner is an unpopulated ObjectId, load the User document
      let ownerUser: any = vendorDoc.owner;
      if (ownerUser && typeof ownerUser === 'object' && ownerUser._id) {
        // Already populated
      } else if (ownerUser) {
        try {
          ownerUser = await this.userModel.findById(ownerUser).exec();
        } catch (e: any) {
          this.logger.warn(`Could not load owner user: ${e.message}`);
        }
      }

      const storeName = vendorDoc.storeName || 'Your Store';
      const ownerId = (ownerUser?._id || vendorDoc.owner)?.toString();
      const vendorPhone = ownerUser?.phone || vendorDoc.phone;
      const fcmToken = vendorDoc.fcmToken || ownerUser?.fcmToken;

      const title = '🚨 New Order on Erranders!';
      const body = `Order #${orderNumber} for ₦${(order.total || 0).toLocaleString()} has arrived at ${storeName}. Please confirm now.`;

      this.logger.log(`[GUARANTEED VENDOR ALERT] Dispatching alerts for order #${orderNumber} to vendor "${storeName}" (phone: ${vendorPhone || 'none'}, ownerId: ${ownerId || 'none'})`);

      // Channel 1: In-App Notification (Socket + Redis)
      if (ownerId) {
        await this.sendNotification(ownerId, {
          title,
          body,
          type: 'NEW_ORDER',
          data: { orderId, orderNumber },
        }).catch(e => this.logger.warn(`In-app vendor notification failed: ${e.message}`));
      }

      // Channel 2: FCM Push Notification
      if (fcmToken) {
        await this.sendPushNotification(fcmToken, {
          title,
          body,
          data: { orderId, orderNumber },
        }).catch(e => this.logger.warn(`FCM vendor push failed: ${e.message}`));
      }

      // Channel 3: SMS Notification
      if (vendorPhone) {
        await this.sendSMS(
          vendorPhone,
          `🚨 Erranders: You have a new order #${orderNumber} for ${storeName} (₦${(order.total || 0).toLocaleString()}). Please open your vendor dashboard to accept it now!`
        ).catch(e => this.logger.warn(`SMS vendor alert failed: ${e.message}`));
      }

      // Channel 4: WhatsApp Notification (direct to vendor/owner phone)
      const comms = await this.getCommunicationsSettingsCached();
      if (vendorPhone && comms?.whatsappEnabled !== false && comms?.whatsappVendorAlertsEnabled !== false) {
        const ownerName = ownerUser?.firstName || vendorDoc.ownerName || '';
        const items = Array.isArray(order.items) ? order.items : [];
        const itemLines = items
          .slice(0, 6)
          .map((i: any) => `• ${i.quantity || 1}x ${i.name || i.product?.name || 'item'}`);

        const waText = [
          ownerName ? `Hi *${ownerName}*, Erranders Bot here 👋` : 'Hi there, Erranders Bot here 👋',
          '━━━━━━━━━━━━━━━━━━━━━━',
          `🚨 *New Order for ${storeName}!*`,
          '',
          `🧾 *Order #${orderNumber}*`,
          `💰 *Total:* ₦${(order.total || 0).toLocaleString()}`,
          ...(itemLines.length ? ['', '📦 *Items Ordered:*', ...itemLines] : []),
          '',
          '👉 *Open your dashboard to accept and start preparing:*',
          'https://vendor.erranders.org/dashboard/orders',
          '',
          '— Erranders Bot',
        ].join('\n');

        await this.sendWhatsApp(vendorPhone, waText, { isPriority: true })
          .catch(e => this.logger.warn(`WhatsApp vendor alert failed: ${e.message}`));
      }

      // 5. Follow-up Check after 90s: If still PENDING, send reminder
      if (orderId) {
        setTimeout(async () => {
          try {
            const checkOrder = await this.orderModel.findById(orderId);
            if (checkOrder && checkOrder.status === OrderStatus.PENDING) {
              if (vendorPhone && comms?.whatsappEnabled !== false && comms?.whatsappVendorAlertsEnabled !== false) {
                const reminderText = `⚠️ *Reminder from Erranders Bot*\n\nOrder #${orderNumber} for ${storeName} is still waiting for your confirmation!\n\nPlease open your dashboard to accept it so an Errand Ninja can be dispatched:\nhttps://vendor.erranders.org/dashboard/orders`;
                await this.sendWhatsApp(vendorPhone, reminderText, { isPriority: true }).catch(() => {});
              }
            }
          } catch (e: any) {
            this.logger.warn(`Vendor reminder check failed: ${e.message}`);
          }
        }, 90000);
      }

    } catch (err: any) {
      this.logger.error(`Failed to execute notifyVendor: ${err.message}`);
    }
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
