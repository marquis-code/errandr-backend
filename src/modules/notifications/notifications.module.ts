import { Module, Global } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsController } from './notifications.controller';
import { CronService } from './cron.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Vendor, VendorSchema } from '../vendors/schemas/vendor.schema';
import { AfricasTalkingModule } from '../africastalking/africastalking.module';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Vendor.name, schema: VendorSchema },
    ]),
    AfricasTalkingModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway, CronService],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}
