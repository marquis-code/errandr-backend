import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderStatus } from '../orders/schemas/order.schema';
import { Vendor } from '../vendors/schemas/vendor.schema';
import { TwilioService } from '../twilio/twilio.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(Vendor.name) private vendorModel: Model<Vendor>,
    private twilioService: TwilioService,
  ) {}

  /**
   * Run every day at 8:00 PM
   */
  @Cron('0 20 * * *')
  async sendDailyEarningsSummary() {
    this.logger.log('Starting Daily Earnings Summary Cron Job...');

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    try {
      // 1. Get all vendors
      const vendors = await this.vendorModel.find({}).populate('owner', 'phone');

      for (const vendor of vendors) {
        const owner = vendor.owner as any;
        if (!owner?.phone) continue;

        // 2. Aggregate earnings for this vendor for today
        const stats = await this.orderModel.aggregate([
          {
            $match: {
              vendor: vendor._id,
              status: OrderStatus.DELIVERED,
              createdAt: { $gte: startOfDay, $lte: endOfDay },
            },
          },
          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
              totalEarnings: { $sum: '$vendorShare' },
            },
          },
        ]);

        if (stats.length > 0 && stats[0].totalOrders > 0) {
          const { totalOrders, totalEarnings } = stats[0];
          
          // 3. Get weekly total (simplified for this task)
          const startOfWeek = new Date();
          startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
          startOfWeek.setHours(0, 0, 0, 0);

          const weeklyStats = await this.orderModel.aggregate([
            {
              $match: {
                vendor: vendor._id,
                status: OrderStatus.DELIVERED,
                createdAt: { $gte: startOfWeek, $lte: endOfDay },
              },
            },
            {
              $group: {
                _id: null,
                weeklyTotal: { $sum: '$vendorShare' },
              },
            },
          ]);

          const weeklyTotal = weeklyStats[0]?.weeklyTotal || totalEarnings;

          // 4. Send SMS via Africa's Talking
          const message = `Erranders: Today you completed ${totalOrders} orders. You earned ₦${totalEarnings.toLocaleString()}. Total this week: ₦${weeklyTotal.toLocaleString()}.`;
          
          await this.twilioService.sendSMS(owner.phone, message);
          this.logger.log(`Sent earnings summary to vendor: ${vendor.storeName}`);
        }
      }
    } catch (error: any) {
      this.logger.error(`Error in Daily Earnings Cron: ${error.message}`, error.stack);
    }

    this.logger.log('Daily Earnings Summary Cron Job Completed.');
  }
}
