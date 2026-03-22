import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

@Processor('orders')
export class OrderProcessor {
  private readonly logger = new Logger(OrderProcessor.name);

  @Process('processPreOrder')
  async handlePreOrder(job: Job) {
    this.logger.log(`Processing pre-order: ${job.data.orderId}`);
    // Logic to notify vendor that it's time to start preparing
    // This would ideally call OrdersService.updateStatus
    return { status: 'processed' };
  }

  @Process('orderTimeout')
  async handleOrderTimeout(job: Job) {
    this.logger.log(`Order timeout check: ${job.data.orderId}`);
    // Logic to check if an order has been unattended for too long
    // If so, trigger the "better algorithm" to find another errander or notify admin
    return { status: 'checked' };
  }
}
