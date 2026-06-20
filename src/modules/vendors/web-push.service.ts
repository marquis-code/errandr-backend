import { Injectable, Logger } from '@nestjs/common';
import * as webpush from 'web-push';

@Injectable()
export class WebPushService {
  private readonly logger = new Logger(WebPushService.name);

  constructor() {
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT) {
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT,
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      );
    } else {
      this.logger.warn('VAPID keys are not configured properly. Push notifications will not work.');
    }
  }

  async sendNotification(subscription: any, payload: any) {
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload));
      return true;
    } catch (error) {
      this.logger.error(`Failed to send push notification: ${error.message}`);
      // If error is 410 (Gone) or 404 (Not Found), it means the subscription is no longer valid
      if (error.statusCode === 410 || error.statusCode === 404) {
        return false; // Indicating the subscription should probably be removed
      }
      throw error;
    }
  }
}
