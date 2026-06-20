import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VendorNotification } from './schemas/vendor-notification.schema';
import { VendorsService } from './vendors.service';
import { EmailService } from '../email/email.service';
import { WebPushService } from './web-push.service';
import { Vendor } from './schemas/vendor.schema';

@Injectable()
export class VendorsCronService {
  private readonly logger = new Logger(VendorsCronService.name);

  constructor(
    @InjectModel(VendorNotification.name) private vendorNotificationModel: Model<VendorNotification>,
    private readonly vendorsService: VendorsService,
    private readonly emailService: EmailService,
    private readonly webPushService: WebPushService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async checkAndNotifyOnlineVendors() {
    // 1. Fetch pending notifications
    const pendingNotifications = await this.vendorNotificationModel.find({ isNotified: false }).populate('vendorId').exec();
    
    if (!pendingNotifications.length) return;

    // Group by vendor
    const notificationsByVendor = new Map<string, VendorNotification[]>();
    for (const notification of pendingNotifications) {
      if (!notification.vendorId) continue;
      
      const vendorIdStr = (notification.vendorId as any)._id.toString();
      if (!notificationsByVendor.has(vendorIdStr)) {
        notificationsByVendor.set(vendorIdStr, []);
      }
      notificationsByVendor.get(vendorIdStr)!.push(notification);
    }

    // 2. Process each vendor
    for (const [vendorIdStr, notifications] of notificationsByVendor.entries()) {
      const vendor = notifications[0].vendorId as any as Vendor;
      
      // Check if vendor is now open
      const { isOpen } = (this.vendorsService as any).checkIsOpen(vendor);
      
      if (isOpen) {
        this.logger.log(`Vendor ${vendor.storeName} is online. Notifying ${notifications.length} users.`);
        
        // Send emails and push notifications
        for (const notif of notifications) {
          try {
            await this.emailService.sendVendorOnlineNotification(
              notif.email,
              vendor.storeName,
              `https://www.erranders.org/vendors/`
            );

            // Dispatch push notification if subscription exists
            if ((notif as any).pushSubscription) {
              await this.webPushService.sendNotification((notif as any).pushSubscription, {
                title: `${vendor.storeName} is Online! 🥳`,
                body: `Great news! ${vendor.storeName} is now ready to accept your orders.`,
                icon: 'https://www.erranders.org/favicon.ico',
                url: `https://www.erranders.org/vendors/`
              });
            }
            
            // Mark as notified
            notif.isNotified = true;
            await notif.save();
          } catch (error) {
            this.logger.error(`Failed to notify ${notif.email} for vendor ${vendor.storeName}: ${error.message}`);
          }
        }
      }
    }
  }
}
