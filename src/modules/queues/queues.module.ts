import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { OrderProcessor } from './processors/order.processor';
import { OrdersModule } from '../orders/orders.module';
import { forwardRef } from '@nestjs/common';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'orders',
    }),
    forwardRef(() => OrdersModule),
  ],
  providers: [OrderProcessor],
  exports: [BullModule],
})
export class QueuesModule {}
