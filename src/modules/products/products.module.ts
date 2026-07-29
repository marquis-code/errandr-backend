import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { Product, ProductSchema } from './schemas/product.schema';
import { ProductCategory, ProductCategorySchema } from './schemas/product-category.schema';
import { Pack, PackSchema } from './schemas/pack.schema';
import { VendorsModule } from '../vendors/vendors.module';
import { GlobalProductsModule } from '../global-products/global-products.module';
import { SystemSetting, SystemSettingSchema } from '../admin/schemas/system-setting.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: ProductCategory.name, schema: ProductCategorySchema },
      { name: Pack.name, schema: PackSchema },
      { name: SystemSetting.name, schema: SystemSettingSchema },
    ]),
    VendorsModule,
    GlobalProductsModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
