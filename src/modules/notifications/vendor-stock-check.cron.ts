import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotificationsService } from './notifications.service';

/**
 * Asks vendors what has run out, three times a day.
 *
 * The problem this solves is not that items sell out — it is how long they stay listed
 * afterwards. A student orders something the vendor has not had since morning, the vendor
 * rejects it, and both the rider and the customer lose twenty minutes. Asking a vendor what
 * is unavailable *before* the rush means the item can be switched off while it still matters.
 *
 * Only vendors who have completed at least one order are asked. Someone who has never traded
 * has nothing to be out of stock of, and a daily message to them is spam on a number we cannot
 * afford to lose.
 */
@Injectable()
export class VendorStockCheckCron implements OnModuleInit {
  private readonly logger = new Logger(VendorStockCheckCron.name);

  constructor(
    @InjectModel('Vendor') private readonly vendorModel: Model<any>,
    @InjectModel('Order') private readonly orderModel: Model<any>,
    private readonly notificationsService: NotificationsService,
  ) {}

  onModuleInit(): void {
    // Says out loud that the schedule is live, so a silent cron cannot be mistaken for a
    // working one in the logs.
    this.logger.log('Stock check scheduled: 08:00, 13:00 and 18:00 Africa/Lagos');
  }

  @Cron('0 0 8 * * *', { name: 'stock-check-morning', timeZone: 'Africa/Lagos' })
  async morning(): Promise<void> {
    await this.ask('morning');
  }

  @Cron('0 0 13 * * *', { name: 'stock-check-afternoon', timeZone: 'Africa/Lagos' })
  async afternoon(): Promise<void> {
    await this.ask('afternoon');
  }

  @Cron('0 0 18 * * *', { name: 'stock-check-evening', timeZone: 'Africa/Lagos' })
  async evening(): Promise<void> {
    await this.ask('evening');
  }

  private async ask(slot: 'morning' | 'afternoon' | 'evening'): Promise<void> {
    try {
      // Vendors who have actually sold something.
      const vendorIds = await this.orderModel.distinct('vendor', {
        vendor: { $ne: null },
        status: { $nin: ['cancelled', 'refunded'] },
      });
      if (!vendorIds?.length) return;

      const vendors = await this.vendorModel
        .find({ _id: { $in: vendorIds }, status: 'approved' })
        .populate('owner', 'firstName phone')
        .lean()
        .exec();

      const opening = {
        morning: 'Morning check-in',
        afternoon: 'Afternoon check-in',
        evening: 'Evening check-in',
      }[slot];

      let sent = 0;
      for (const vendor of vendors as any[]) {
        const phone = vendor.owner?.phone || vendor.phone;
        if (!phone) continue;

        const name = vendor.owner?.firstName || vendor.storeName || 'there';
        const text = [
          `Hi ${name}, Erranders Bot here 👋`,
          '',
          `This is your ${opening}. I'm the automated assistant for Erranders, and I ask our vendors this three times a day.`,
          '',
          'Is anything out of stock right now? If so, reply with the item and when it will be back. We will switch it off in the app so students cannot order it by mistake.',
          '',
          'If everything is available, just reply "all good".',
          '',
          '— Erranders Bot',
        ].join('\n');

        await this.notificationsService.sendWhatsApp(phone, text).catch(() => {});
        sent += 1;

        // A burst of identical messages is what gets a number flagged; the group strategy
        // elsewhere exists for the same reason.
        await new Promise((r) => setTimeout(r, 1500));
      }

      this.logger.log(`Stock check (${slot}): asked ${sent} of ${vendors.length} vendors`);
    } catch (e: any) {
      this.logger.error(`Stock check (${slot}) failed: ${e?.message || e}`);
    }
  }
}
