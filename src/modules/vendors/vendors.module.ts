import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VendorsService } from './vendors.service';
import { VendorsController } from './vendors.controller';
import { BannersCron } from './banners.cron';
import { Vendor, VendorSchema } from './schemas/vendor.schema';
import { VendorNotification, VendorNotificationSchema } from './schemas/vendor-notification.schema';
import { VendorsCronService } from './vendors.cron';
import { WebPushService } from './web-push.service';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Service, ServiceSchema } from '../services/schemas/service.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { EmailModule } from '../email/email.module';
import { MenuItem, MenuItemSchema } from '../menu/schemas/menu-item.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Vendor.name, schema: VendorSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Service.name, schema: ServiceSchema },
      { name: Order.name, schema: OrderSchema },
      { name: VendorNotification.name, schema: VendorNotificationSchema },
      { name: MenuItem.name, schema: MenuItemSchema },
    ]),
    EmailModule,
  ],
  controllers: [VendorsController],
  providers: [VendorsService, BannersCron, VendorsCronService, WebPushService],
  exports: [VendorsService, MongooseModule],
})
export class VendorsModule {}
