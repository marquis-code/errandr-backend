import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { QueuesModule } from '../queues/queues.module';
import { WalletsModule } from '../wallets/wallets.module';
import { forwardRef } from '@nestjs/common';
import { Order, OrderSchema } from './schemas/order.schema';
import { Vendor, VendorSchema } from '../vendors/schemas/vendor.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Errander, ErranderSchema } from '../erranders/schemas/errander.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { MenuItem, MenuItemSchema } from '../menu/schemas/menu-item.schema';
import { SystemSetting, SystemSettingSchema } from '../admin/schemas/system-setting.schema';

import { PaymentsModule } from '../payments/payments.module';
import { ChatModule } from '../chat/chat.module';
import { ScheduleModule } from '@nestjs/schedule';
import { UsersModule } from '../users/users.module';
import { BatchDeliveryService } from './batch-delivery.service';
import { RewardsModule } from '../rewards/rewards.module';
import { SimulationController } from './simulation.controller';
import { AfricasTalkingModule } from '../africastalking/africastalking.module';
import { PromoCodesModule } from '../promo-codes/promo-codes.module';

import { ErrandPool, ErrandPoolSchema } from './schemas/errand-pool.schema';
import { ExamModeModule } from '../exam-mode/exam-mode.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Vendor.name, schema: VendorSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Errander.name, schema: ErranderSchema },
      { name: User.name, schema: UserSchema },
      { name: MenuItem.name, schema: MenuItemSchema },
      { name: SystemSetting.name, schema: SystemSettingSchema },
      { name: ErrandPool.name, schema: ErrandPoolSchema },
    ]),
    NotificationsModule,
    ChatModule,
    ScheduleModule.forRoot(),
    UsersModule,
    forwardRef(() => QueuesModule),
    forwardRef(() => WalletsModule),
    forwardRef(() => PaymentsModule),
    RewardsModule,
    forwardRef(() => AfricasTalkingModule),
    PromoCodesModule,
    forwardRef(() => ExamModeModule),
  ],
  controllers: [OrdersController, SimulationController],
  providers: [OrdersService, BatchDeliveryService],
  exports: [OrdersService, BatchDeliveryService, MongooseModule],
})
export class OrdersModule {}
