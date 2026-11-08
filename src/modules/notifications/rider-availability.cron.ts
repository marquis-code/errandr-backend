import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotificationsService } from './notifications.service';

/**
 * Tells the team when nobody can take an order.
 *
 * The failure this prevents is not a technical one. An ambassador sends a first-time customer to
 * the site, the customer orders, and no rider exists — the customer concludes the app is dead and
 * tells other people. That costs more trust than a bad delivery does, because it happens before
 * anyone has had a good experience to weigh against it.
 *
 * So: while the doors are open, if no rider is free, say so in the CS group. When riders come
 * back, say that too — otherwise the team keeps the campaign paused long after it could resume.
 */
@Injectable()
export class RiderAvailabilityCron implements OnModuleInit {
  private readonly logger = new Logger(RiderAvailabilityCron.name);

  /** In-memory on purpose: a restart re-announces once, which is harmless and better than silence. */
  private announcedShortage = false;
  private lastAlertAt = 0;

  constructor(
    @InjectModel('Errander') private readonly erranderModel: Model<any>,
    private readonly notificationsService: NotificationsService,
  ) {}

  onModuleInit(): void {
    this.logger.log('Rider availability watch scheduled: every 15 minutes, 07:00-22:00 Africa/Lagos');
  }

  @Cron('0 */15 7-21 * * *', { name: 'rider-availability-watch', timeZone: 'Africa/Lagos' })
  async check(): Promise<void> {
    try {
      // 'available' with no recent heartbeat is a stale flag, not a rider who can help.
      // Riders with no heartbeat yet are counted, so deploying this cannot cause a false alarm
      // before the first one arrives.
      const cutoff = new Date(Date.now() - 10 * 60 * 1000);
      const recentlySeen = {
        $or: [{ lastActiveAt: { $exists: false } }, { lastActiveAt: null }, { lastActiveAt: { $gte: cutoff } }],
      };

      const [available, busy, total] = await Promise.all([
        this.erranderModel.countDocuments({ status: 'available', ...recentlySeen }),
        this.erranderModel.countDocuments({ status: 'busy' }),
        this.erranderModel.countDocuments({}),
      ]);

      const comms: any = await this.notificationsService.getCommunicationsSettingsCached();
      if (comms?.whatsappEnabled === false) return;

      const target = comms?.whatsappSupportGroupJid;
      if (!target) {
        this.logger.warn('No CS group configured — cannot announce rider shortage');
        return;
      }

      const noRidersFree = available === 0;

      if (noRidersFree && !this.announcedShortage) {
        // One alert per shortage, not one every fifteen minutes.
        this.announcedShortage = true;
        this.lastAlertAt = Date.now();

        const text = busy > 0
          ? [
              '🤖 *Erranders Bot*',
              '',
              'No rider is free right now.',
              `${busy} rider${busy === 1 ? ' is' : 's are'} busy. ${total} registered.`,
              '',
              'New orders will sit until one finishes. Pause promotion until this clears.',
            ].join('\n')
          : [
              '🤖 *Erranders Bot*',
              '',
              'No rider is online right now.',
              `${total} registered, none available.`,
              '',
              'Any order placed now will not be picked up. Pause promotion until riders are back.',
            ].join('\n');

        await this.notificationsService.sendWhatsApp(target, text).catch(() => {});
        this.logger.warn(`Rider shortage announced: available=0 busy=${busy} total=${total}`);
        return;
      }

      if (!noRidersFree && this.announcedShortage) {
        this.announcedShortage = false;

        const text = [
          '🤖 *Erranders Bot*',
          '',
          `Riders are back — ${available} available now.`,
          '',
          'You can resume promotion.',
        ].join('\n');

        await this.notificationsService.sendWhatsApp(target, text).catch(() => {});
        this.logger.log(`Rider availability restored: available=${available}`);
      }
    } catch (e: any) {
      this.logger.error(`Rider availability check failed: ${e?.message || e}`);
    }
  }
}
