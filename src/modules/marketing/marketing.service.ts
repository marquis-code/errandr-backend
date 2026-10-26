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

  // Daily Digest: Permanently disabled to stop consuming email credits
  // @Cron('30 8 * * *')
  async sendDailyMarketing() {
    this.logger.log('Daily morning marketing email reminder is permanently disabled to conserve email credits.');
    return;
  }
}
