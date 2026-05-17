import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);
  private client: Twilio;

  constructor(
    private configService: ConfigService,
  ) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    if (accountSid && authToken) {
      this.client = new Twilio(accountSid, authToken);
    }
  }

  /**
   * Send SMS via Twilio
   */
  async sendSMS(to: string, message: string): Promise<boolean> {
    try {
      const from = this.configService.get<string>('TWILIO_NUMBER');
      await this.client.messages.create({
        body: message,
        from,
        to: this.formatPhoneNumber(to),
      });
      return true;
    } catch (error) {
      this.logger.error(`Twilio SMS Error: ${error.message}`);
      return false;
    }
  }

  /**
   * Send SMS OTP via Twilio
   */
  async sendSMSOTP(to: string, otp: string): Promise<boolean> {
    return this.sendSMS(to, `Your Erranders code is: ${otp}`);
  }

  /**
   * Initiate an interactive order dispatch call
   */
  async sendOrderDispatchCall(to: string, orderData: { orderNumber: string, orderId: string, items: string[], total: number }): Promise<void> {
    const baseUrl = this.configService.get<string>('BACKEND_BASE_URL');
    const from = this.configService.get<string>('TWILIO_NUMBER') || '';

    try {
      await this.client.calls.create({
        from,
        to: this.formatPhoneNumber(to),
        url: `${baseUrl}/api/v1/twilio/voice/order-dispatch?orderId=${orderData.orderId}&orderNumber=${orderData.orderNumber}&items=${encodeURIComponent(orderData.items.join(', '))}&total=${orderData.total}`,
      });
      this.logger.log(`Initiated Twilio order dispatch call to ${to} for order ${orderData.orderNumber}`);
    } catch (error) {
      this.logger.error(`Twilio Call Error (Order Dispatch): ${error.message}`);
    }
  }

  /**
   * Initiate an interactive errander dispatch call
   */
  async sendErranderDispatchCall(to: string, deliveryData: { orderNumber: string, orderId: string, vendorName: string, deliveryFee: number, userId: string }): Promise<void> {
    const baseUrl = this.configService.get<string>('BACKEND_BASE_URL');
    const from = this.configService.get<string>('TWILIO_NUMBER') || '';

    try {
      await this.client.calls.create({
        from,
        to: this.formatPhoneNumber(to),
        url: `${baseUrl}/api/v1/twilio/voice/errander-dispatch?orderId=${deliveryData.orderId}&vendorName=${encodeURIComponent(deliveryData.vendorName)}&fee=${deliveryData.deliveryFee}&userId=${deliveryData.userId}`,
      });
      this.logger.log(`Initiated Twilio errander dispatch call to ${to} for order ${deliveryData.orderNumber}`);
    } catch (error) {
      this.logger.error(`Twilio Call Error (Errander Dispatch): ${error.message}`);
    }
  }

  /**
   * Send Voice OTP
   */
  async sendVoiceOTP(to: string, otp: string): Promise<void> {
    const baseUrl = this.configService.get<string>('BACKEND_BASE_URL');
    const from = this.configService.get<string>('TWILIO_NUMBER') || '';

    try {
      await this.client.calls.create({
        from,
        to: this.formatPhoneNumber(to),
        url: `${baseUrl}/api/v1/twilio/voice/otp?otp=${otp}`,
      });
    } catch (error) {
      this.logger.error(`Twilio Call Error (OTP): ${error.message}`);
    }
  }

  /**
   * Generic make call (can be used for announcements)
   */
  async makeCall(to: string, payload: { message: string }): Promise<void> {
    const baseUrl = this.configService.get<string>('BACKEND_BASE_URL');
    const from = this.configService.get<string>('TWILIO_NUMBER') || '';

    try {
      await this.client.calls.create({
        from,
        to: this.formatPhoneNumber(to),
        twiml: `<Response><Say>${payload.message}</Say></Response>`,
      });
    } catch (error) {
      this.logger.error(`Twilio Call Error: ${error.message}`);
    }
  }

  private formatPhoneNumber(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0') && cleaned.length === 11) cleaned = '234' + cleaned.substring(1);
    else if (cleaned.length === 10) cleaned = '234' + cleaned;
    return '+' + cleaned;
  }
}
