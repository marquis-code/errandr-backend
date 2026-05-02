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

  // Morning Peak: 8:30 AM
  @Cron('30 8 * * *')
  async sendMorningMarketing() {
    this.logger.log('Sending morning marketing emails...');
    const users = await this.userModel.find({ isVerified: true });
    
    // Pick 2 featured vendors
    const vendors = await this.vendorModel.find({ isOnline: true }).limit(2);
    
    for (const user of users) {
      await this.emailService.sendPromotionalEmail(
        user.email,
        "Morning, Chef! ☕️ Breakfast is Served",
        "Wake up to the best campus breakfasts!",
        "Don't start your lectures on an empty stomach. From hot akara and bread to fresh coffee, our campus plugs are open and ready to deliver sharp-sharp to your hostel.",
        "ORDER BREAKFAST NOW",
        "https://errandr.shop/vendors",
        "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80"
      );
    }
  }

  // Afternoon Peak: 1:30 PM (Lunch)
  @Cron('30 13 * * *')
  async sendAfternoonMarketing() {
    this.logger.log('Sending afternoon marketing emails...');
    const users = await this.userModel.find({ isVerified: true });
    
    for (const user of users) {
      await this.emailService.sendPromotionalEmail(
        user.email,
        "Hungry yet? 🍱 Lunch is just a tap away",
        "Refuel with Errandr Lunch Deals",
        "That 12 PM lecture was long, we know. Skip the cafeteria queue and order from your favorite campus eatery. Best price, fastest delivery, zero stress.",
        "SECURE MY LUNCH",
        "https://errandr.shop/vendors",
        "https://images.unsplash.com/photo-1547592180-85f173990554?w=800&q=80"
      );
    }
  }

  // Evening Peak: 7:00 PM (Dinner & Late Night)
  @Cron('0 19 * * *')
  async sendEveningMarketing() {
    this.logger.log('Sending evening marketing emails...');
    const users = await this.userModel.find({ isVerified: true });
    
    for (const user of users) {
      await this.emailService.sendPromotionalEmail(
        user.email,
        "Dinner Time! 🌙 Don't let Sapa win",
        "End your day with a feast",
        "You worked hard today. Treat yourself to something special. From spicy noodles to solid swallow, we've got you covered for the late-night study sessions too.",
        "ORDER DINNER",
        "https://errandr.shop/vendors",
        "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80"
      );
    }
  }
}
