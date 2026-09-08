import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RecurringOrdersService } from './recurring-orders.service';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';

@Injectable()
export class RecurringOrdersCronService {
  private readonly logger = new Logger(RecurringOrdersCronService.name);

  constructor(
    private readonly recurringOrdersService: RecurringOrdersService,
    @InjectQueue('recurring-orders-queue') private readonly recurringOrdersQueue: Queue,
  ) {}

  // Run every day at 1:00 AM
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleDailyRecurringOrders() {
    this.logger.debug('Running daily recurring orders cron job...');

    const today = new Date();
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDayStr = daysOfWeek[today.getDay()];

    try {
      // Find all active recurring orders scheduled for today
      const ordersForToday = await this.recurringOrdersService.getActiveForToday(currentDayStr);

      this.logger.debug(`Found ${ordersForToday.length} recurring orders for today (${currentDayStr}).`);

      for (const order of ordersForToday) {
        // Skip if we already processed it today
        if (order.lastRunAt && this.isSameDay(order.lastRunAt, today)) {
          continue;
        }

        // Push to Bull queue for processing (wallet deduction + order creation)
        await this.recurringOrdersQueue.add('process-recurring-order', {
          recurringOrderId: order._id.toString(),
        }, {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        });
        
        // Update last run immediately to prevent double processing in case of cron re-triggers
        await this.recurringOrdersService.updateLastRun(order._id.toString(), today);
      }
    } catch (error) {
      this.logger.error('Error running daily recurring orders cron job', error.stack);
    }
  }

  private isSameDay(d1: Date, d2: Date): boolean {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  }
}
