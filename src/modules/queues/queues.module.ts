import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { OrderProcessor } from './processors/order.processor';
import { RecurringOrderProcessor } from './recurring-order.processor';
import { OrdersModule } from '../orders/orders.module';
import { WalletsModule } from '../wallets/wallets.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'orders',
    }),
    BullModule.registerQueue({
      name: 'recurring-orders-queue',
    }),
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    forwardRef(() => OrdersModule),
    forwardRef(() => WalletsModule),
    NotificationsModule,
  ],
  providers: [OrderProcessor, RecurringOrderProcessor],
  exports: [BullModule],
})
export class QueuesModule {}
