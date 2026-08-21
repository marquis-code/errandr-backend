import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../users/schemas/user.schema';
import { EmailService } from '../email/email.service';
import { Vendor } from '../vendors/schemas/vendor.schema';

@Injectable()
export class MarketingService {
  private readonly logger = new Logger(MarketingService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Vendor.name) private vendorModel: Model<Vendor>,
    private emailService: EmailService,
  ) {}

  // Daily Digest: 8:30 AM
  @Cron('30 8 * * *')
  async sendDailyMarketing() {
    this.logger.log('Sending daily marketing emails...');
    const users = await this.userModel.find({ isVerified: true });
    
    // Pick 2 featured vendors
    const vendors = await this.vendorModel.find({ isOnline: true }).limit(2);
    
    for (const user of users) {
      await this.emailService.sendPromotionalEmail(
        user.email,
        "Your Daily Craving Guide! 🍽️ Breakfast, Lunch & Dinner",
        "Fuel your entire day with Erranders",
        "Whether it's a hot coffee to kickstart your morning, a quick lunch between lectures, or a hearty dinner after a long day of study, Erranders has got you covered! Order from your favorite campus eateries without stepping out. Best prices, fast delivery, zero stress all day long.",
        "ORDER YOUR MEALS TODAY",
        "https://erranders.org/vendors",
        "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80"
      );
    }
  }
}
