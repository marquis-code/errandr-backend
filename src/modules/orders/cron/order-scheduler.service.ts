import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderStatus } from '../schemas/order.schema';
import { OrdersService } from '../orders.service';

@Injectable()
export class OrderSchedulerService {
  private readonly logger = new Logger(OrderSchedulerService.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
    private readonly ordersService: OrdersService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledOrders() {
    const now = new Date();
    
    // Find all scheduled orders where the scheduled time has passed
    const orders = await this.orderModel.find({
      status: OrderStatus.SCHEDULED,
      scheduledTime: { $lte: now },
    });

    if (orders.length > 0) {
      this.logger.log(`Found ${orders.length} scheduled orders to activate`);
    }

    for (const order of orders) {
      this.logger.log(`Activating scheduled order ${order.orderNumber}`);
      
      // Update status to CONFIRMED
      order.status = OrderStatus.CONFIRMED;
      order.statusHistory.push({
        status: OrderStatus.CONFIRMED,
        timestamp: new Date(),
        note: 'Scheduled order activated (vendor is now open)',
      });
      await order.save();

      // Trigger standard order broadcasts to vendor and erranders
      try {
        await this.ordersService.broadcastNewOrderToErranders(order);
      } catch (err) {
        this.logger.error(`Failed to broadcast order ${order.orderNumber}: ${err.message}`);
      }
    }
  }
}
