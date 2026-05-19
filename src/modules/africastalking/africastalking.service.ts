import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class AfricasTalkingService {
  private readonly logger = new Logger(AfricasTalkingService.name);

  private readonly username: string;
  private readonly apiKey: string;
  private readonly fromNumber: string;
  private readonly isSandbox: boolean;

  private readonly smsUrl: string;
  private readonly voiceUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.username = this.configService.get<string>('AFRICASTALKING_USERNAME') || 'sandbox';
    this.apiKey = this.configService.get<string>('AFRICASTALKING_API_KEY') || '';
    this.fromNumber = this.configService.get<string>('AFRICASTALKING_FROM_NUMBER') || '';
    this.isSandbox = this.username.toLowerCase() === 'sandbox';

    this.smsUrl = this.isSandbox
      ? 'https://api.sandbox.africastalking.com/version1/messaging'
      : 'https://api.africastalking.com/version1/messaging';

    this.voiceUrl = this.isSandbox
      ? 'https://voice.sandbox.africastalking.com/call'
      : 'https://voice.africastalking.com/call';
  }

  /**
   * Send SMS via Africa's Talking
   */
  async sendSMS(to: string, message: string): Promise<boolean> {
    try {
      const formattedTo = this.formatPhoneNumber(to);
      const params = new URLSearchParams();
      params.append('username', this.username);
      params.append('to', formattedTo);
      params.append('message', message);
      if (this.fromNumber) {
        params.append('from', this.fromNumber);
      }

      const response = await axios.post(this.smsUrl, params, {
        headers: {
          'apikey': this.apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
      });

      this.logger.log(`SMS successfully sent via Africa's Talking to ${formattedTo}`);
      return response.status === 200 || response.status === 201;
    } catch (error) {
      this.logger.error(`Africa's Talking SMS Error: ${error.response?.data?.errorMessage || error.message}`);
      return false;
    }
  }

  /**
   * Send SMS OTP via Africa's Talking
   */
  async sendSMSOTP(to: string, otp: string): Promise<boolean> {
    return this.sendSMS(to, `Your Erranders code is: ${otp}`);
  }

  /**
   * Initiate an interactive order dispatch call
   */
  async sendOrderDispatchCall(
    to: string,
    orderData: { orderNumber: string; orderId: string; items: string[]; total: number },
  ): Promise<void> {
    const baseUrl = this.configService.get<string>('BACKEND_BASE_URL');
    const formattedTo = this.formatPhoneNumber(to);

    try {
      const params = new URLSearchParams();
      params.append('username', this.username);
      params.append('from', this.fromNumber);
      params.append('to', formattedTo);

      // Pass request ID/metadata if needed, or query params on the registered webhook route
      // Wait, since we are doing calling, we specify standard caller options. 
      // Africa's Talking will call the recipient, then trigger our default Callback URL registered in dashboard.
      // Alternatively, we can pass clientRequestId or tags if needed.
      // BUT WAIT: The callback URL is defined globally in the Africa's Talking Dashboard.
      // When AT calls our callback URL on connected call, it expects XML.
      // We will configure their webhook to point to:
      // ${baseUrl}/api/v1/twilio/voice/order-dispatch?orderId=${orderData.orderId}&orderNumber=${orderData.orderNumber}&items=${encodeURIComponent(orderData.items.join(', '))}&total=${orderData.total}
      // Wait, is there a way to dynamically pass the callback URL on call creation?
      // No, in Africa's Talking, call endpoints trigger the callback URL configured in the dashboard.
      // BUT they pass any query parameters or custom headers, or we can use the `clientRequestId` to associate!
      // Wait, does the callback URL configured in dashboard get called with custom query parameters?
      // No, AT calls the exact URL configured in dashboard, but they send DTMF input/session information.
      // To route calls dynamically without hardcoding static IDs in Africa's Talking dashboard:
      // We can use a session store, or use `clientRequestId`! When AT calls us, the POST payload includes `clientRequestId`.
      // Let's verify this from the docs:
      // "clientRequestId: Variable sent to your Events Callback URL that can be used to tag the call"
      // Wait, the main voice callback URL is triggered when the call is received/connected.
      // In the AT Voice Dashboard, you specify one Callback URL.
      // Let's make sure our controller handles both query params and clientRequestId to make it extremely dynamic!
      // But wait! When we initiate the call using:
      // voice.call({ from, to, clientRequestId })
      // The POST payload sent to our voice callback URL has `clientRequestId`!
      // So we can pass a structured string in `clientRequestId` (like `order-dispatch:${orderData.orderId}:${orderData.orderNumber}:${orderData.total}:${encodeURIComponent(orderData.items.join(','))}`).
      // Or we can dynamically save/cache this in our Redis/RAM to look it up using the `sessionId` or `clientRequestId`.
      // But actually, structured string in `clientRequestId` is an incredibly elegant, stateless way to pass all variables!
      // Let's check: "clientRequestId: Variable sent to your Events Callback URL that can be used to tag the call"
      // Wait, does it get sent to the main Callback URL? Yes, "Variable sent to your Events Callback URL that can be used to tag the call" or the main callback payload itself.
      // Let's check the POST Payload table in the image:
      // Fields: isActive, sessionId, direction, callerNumber, destinationNumber, dtmfDigits, recordingUrl, durationInSeconds, currencyCode, amount.
      // Wait! The POST payload to the voice callback URL does NOT list `clientRequestId` directly in the session callback, but wait, let's verify if they pass it or if we can use another mechanism.
      // Actually, since Erranders might just have a single active dispatch or we can look up the latest order for that phone number, or we can pass a static callback and let our server check the caller's database record!
      // Yes! Since the call is made to a specific vendor phone number or errander phone number, we can simply look up the active pending order in the database for `callerNumber` or `destinationNumber`!
      // This is extremely robust and does not require complex parameter passing!
      // Wait, in `twilio.controller.ts`:
      // The voice dispatch webhook receives:
      // `/voice/order-dispatch?orderId=${orderId}&orderNumber=${orderNumber}&items=${items}&total=${total}`
      // If we still want this to work dynamically, does Africa's Talking support changing the callback URL on call creation?
      // No, Africa's Talking Voice calling endpoint is `https://voice.africastalking.com/call`.
      // It takes `username`, `from`, `to`, `clientRequestId`.
      // Since it triggers the global Callback URL set in the Africa's Talking dashboard, we can set that Callback URL to:
      // `${baseUrl}/api/v1/africastalking/voice/callback`
      // Inside `/africastalking/voice/callback`, when the call connects, our server gets:
      // `isActive=1`, `direction=outbound`, `destinationNumber=+234xxxxxxxx` (the recipient's number).
      // We can look up the most recent order for that recipient's phone number!
      // Let's check: Is that how we can resolve orderId, orderNumber, items, total?
      // Yes! Or we can serialize the data in `clientRequestId` when calling.
      // Wait, let's check if the AT callback payload contains `clientRequestId`? No, but wait, when we initiate the call, we can save the session or order mapping in memory (or our Redis) mapped by the recipient's phone number!
      // E.g., `activeCalls.set(formattedTo, { orderId, orderNumber, items, total, type: 'order-dispatch' })`.
      // Then, when Africa's Talking hits our callback URL, we look up the number `destinationNumber` (or `callerNumber` depending on direction) in our active dispatches, generate the correct XML, and serve it!
      // This is incredibly clean, robust, and state-of-the-art!
      // Let's implement an in-memory/state lookup in `AfricasTalkingService` for active calls.

      this.registerActiveCall(formattedTo, {
        type: 'order-dispatch',
        orderId: orderData.orderId,
        orderNumber: orderData.orderNumber,
        items: orderData.items,
        total: orderData.total,
      });

      await this.initiateCall(formattedTo);
      this.logger.log(`Initiated Africa's Talking voice order dispatch call to ${formattedTo} for order ${orderData.orderNumber}`);
    } catch (error) {
      this.logger.error(`Africa's Talking Voice Error (Order Dispatch): ${error.message}`);
    }
  }

  /**
   * Initiate an interactive errander dispatch call
   */
  async sendErranderDispatchCall(
    to: string,
    deliveryData: { orderNumber: string; orderId: string; vendorName: string; deliveryFee: number; userId: string },
  ): Promise<void> {
    const formattedTo = this.formatPhoneNumber(to);

    try {
      this.registerActiveCall(formattedTo, {
        type: 'errander-dispatch',
        orderId: deliveryData.orderId,
        orderNumber: deliveryData.orderNumber,
        vendorName: deliveryData.vendorName,
        fee: deliveryData.deliveryFee,
        userId: deliveryData.userId,
      });

      await this.initiateCall(formattedTo);
      this.logger.log(`Initiated Africa's Talking errander dispatch call to ${formattedTo} for order ${deliveryData.orderNumber}`);
    } catch (error) {
      this.logger.error(`Africa's Talking Voice Error (Errander Dispatch): ${error.message}`);
    }
  }

  /**
   * Send Voice OTP
   */
  async sendVoiceOTP(to: string, otp: string): Promise<void> {
    const formattedTo = this.formatPhoneNumber(to);

    try {
      this.registerActiveCall(formattedTo, {
        type: 'voice-otp',
        otp,
      });

      await this.initiateCall(formattedTo);
      this.logger.log(`Initiated Africa's Talking voice OTP call to ${formattedTo}`);
    } catch (error) {
      this.logger.error(`Africa's Talking Voice Error (OTP): ${error.message}`);
    }
  }

  /**
   * Generic make call (can be used for announcements)
   */
  async makeCall(to: string, payload: { message: string }): Promise<void> {
    const formattedTo = this.formatPhoneNumber(to);

    try {
      this.registerActiveCall(formattedTo, {
        type: 'announcement',
        message: payload.message,
      });

      await this.initiateCall(formattedTo);
      this.logger.log(`Initiated Africa's Talking voice call to ${formattedTo}`);
    } catch (error) {
      this.logger.error(`Africa's Talking Voice Error: ${error.message}`);
    }
  }

  // --- Active Call Store (Stateless fallback or in-memory map) ---
  // To keep it robust, we'll store active call state by phone number.
  private static activeCalls = new Map<string, any>();

  private registerActiveCall(phone: string, data: any) {
    // Store data. We clean phone to be safe.
    const key = phone.replace('+', '');
    AfricasTalkingService.activeCalls.set(key, {
      ...data,
      timestamp: Date.now(),
    });

    // Automatically clean up stale entries after 10 minutes
    setTimeout(() => {
      const entry = AfricasTalkingService.activeCalls.get(key);
      if (entry && Date.now() - entry.timestamp > 600000) {
        AfricasTalkingService.activeCalls.delete(key);
      }
    }, 600000);
  }

  public getActiveCall(phone: string): any {
    const key = phone.replace('+', '');
    return AfricasTalkingService.activeCalls.get(key);
  }

  public clearActiveCall(phone: string) {
    const key = phone.replace('+', '');
    AfricasTalkingService.activeCalls.delete(key);
  }

  // --- Helper: Call Out HTTP Request ---
  private async initiateCall(to: string): Promise<void> {
    const params = new URLSearchParams();
    params.append('username', this.username);
    params.append('from', this.fromNumber);
    params.append('to', to);

    await axios.post(this.voiceUrl, params, {
      headers: {
        'apikey': this.apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
    });
  }

  private formatPhoneNumber(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0') && cleaned.length === 11) {
      cleaned = '234' + cleaned.substring(1);
    } else if (cleaned.length === 10) {
      cleaned = '234' + cleaned;
    }
    return '+' + cleaned;
  }
}
