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

        // Find the schedule for today
        const scheduleForToday = order.schedules.find(s => s.day === currentDayStr);
        let processTime = new Date(today);
        let hasExactTime = false;

        if (scheduleForToday?.exactTime) {
          hasExactTime = true;
          // exactTime is like "14:30" or "08:00 AM". Let's assume it's stored as "HH:mm" 24h format for simplicity
          // However, if the UI sends "08:30 AM", we must parse it.
          const timeStr = scheduleForToday.exactTime.trim();
          let hours = 0;
          let mins = 0;
          if (timeStr.toLowerCase().includes('am') || timeStr.toLowerCase().includes('pm')) {
            const [time, modifier] = timeStr.split(' ');
            let [h, m] = time.split(':');
            hours = parseInt(h, 10);
            mins = parseInt(m, 10);
            if (modifier.toLowerCase() === 'pm' && hours < 12) hours += 12;
            if (modifier.toLowerCase() === 'am' && hours === 12) hours = 0;
          } else {
            const [h, m] = timeStr.split(':');
            hours = parseInt(h, 10);
            mins = parseInt(m, 10);
          }
          processTime.setHours(hours, mins, 0, 0);
        } else {
          // Fallback if no exactTime: map timeWindow to a default time
          // e.g. "08:00 AM - 10:00 AM" -> 08:00
          if (scheduleForToday?.timeWindow) {
            const timeStr = scheduleForToday.timeWindow.split('-')[0].trim(); // "08:00 AM"
            let hours = 0;
            let mins = 0;
            if (timeStr.toLowerCase().includes('am') || timeStr.toLowerCase().includes('pm')) {
              const [time, modifier] = timeStr.split(' ');
              let [h, m] = time.split(':');
              hours = parseInt(h, 10);
              mins = parseInt(m, 10);
              if (modifier.toLowerCase() === 'pm' && hours < 12) hours += 12;
              if (modifier.toLowerCase() === 'am' && hours === 12) hours = 0;
            } else {
              const [h, m] = timeStr.split(':');
              hours = parseInt(h, 10);
              mins = parseInt(m, 10);
            }
            processTime.setHours(hours, mins, 0, 0);
          } else {
             processTime.setHours(12, 0, 0, 0); // Safe fallback to 12 PM
          }
        }

        const now = new Date();
        const delayToProcess = processTime.getTime() - now.getTime();
        
        // Push to Bull queue for processing (wallet deduction + order creation)
        if (delayToProcess > 0) {
          // Schedule actual order processing
          await this.recurringOrdersQueue.add('process-recurring-order', {
            recurringOrderId: order._id.toString(),
          }, {
            delay: delayToProcess,
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
          });

          // Schedule reminder email (2 hours before, or immediately if less than 2 hours away)
          const delayToReminder = Math.max(0, delayToProcess - (2 * 60 * 60 * 1000));
          await this.recurringOrdersQueue.add('send-recurring-reminder', {
            recurringOrderId: order._id.toString(),
            exactTime: processTime.toISOString()
          }, {
            delay: delayToReminder,
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
          });

        } else {
          // Past time (e.g. cron ran late or exact time was earlier than cron). Process immediately.
          await this.recurringOrdersQueue.add('process-recurring-order', {
            recurringOrderId: order._id.toString(),
          }, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
          });
        }
        
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
