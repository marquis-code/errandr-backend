import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Vendor } from './schemas/vendor.schema';

@Injectable()
export class BannersCron {
  private readonly logger = new Logger(BannersCron.name);

  constructor(
    @InjectModel(Vendor.name) private vendorModel: Model<Vendor>,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleBannerScheduling() {
    this.logger.log('Running banner scheduling cron job...');
    const now = new Date();

    const vendors = await this.vendorModel.find({
      'banners.0': { $exists: true }, // Only check vendors with banners
    });

    for (const vendor of vendors) {
      let modified = false;
      for (const banner of vendor.banners) {
        const shouldBeActive = this.isBannerActive(banner, now);
        if (banner.isActive !== shouldBeActive) {
          banner.isActive = shouldBeActive;
          modified = true;
          this.logger.log(`Banner "${banner.title}" in vendor "${vendor.storeName}" is now ${shouldBeActive ? 'ACTIVE' : 'INACTIVE'}`);
        }
      }

      if (modified) {
        await vendor.save();
      }
    }
  }

  private isBannerActive(banner: any, now: Date): boolean {
    if (banner.startAt && now < new Date(banner.startAt)) {
      return false;
    }
    if (banner.endAt && now > new Date(banner.endAt)) {
      return false;
    }
    return true;
  }
}
