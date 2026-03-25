import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VendorsService } from './vendors.service';
import { VendorsController } from './vendors.controller';
import { BannersCron } from './banners.cron';
import { Vendor, VendorSchema } from './schemas/vendor.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Vendor.name, schema: VendorSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
    EmailModule,
  ],
  controllers: [VendorsController],
  providers: [VendorsService, BannersCron],
  exports: [VendorsService, MongooseModule],
})
export class VendorsModule {}
