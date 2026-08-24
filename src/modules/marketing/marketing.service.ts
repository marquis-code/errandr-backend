import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../users/schemas/user.schema';
import { EmailService } from '../email/email.service';
import { Vendor } from '../vendors/schemas/vendor.schema';
import { Order } from '../orders/schemas/order.schema';

@Injectable()
export class MarketingService {
  private readonly logger = new Logger(MarketingService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Vendor.name) private vendorModel: Model<Vendor>,
    @InjectModel(Order.name) private orderModel: Model<Order>,
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
      const orderCount = await this.orderModel.countDocuments({ customer: user._id });
      await this.emailService.sendCuteDailyEmail(
        user.email,
        `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        user.points || 0,
        orderCount
      );
    }
  }
}
