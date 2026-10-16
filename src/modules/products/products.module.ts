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
import { Vendor, VendorSchema } from '../vendors/schemas/vendor.schema';
import { InstitutionsModule } from '../institutions/institutions.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: ProductCategory.name, schema: ProductCategorySchema },
      { name: Pack.name, schema: PackSchema },
      { name: SystemSetting.name, schema: SystemSettingSchema },
      // Needed to resolve the campus's vendor ids for institution scoping.
      { name: Vendor.name, schema: VendorSchema },
    ]),
    VendorsModule,
    GlobalProductsModule,
    // Exports InstitutionResolver so list queries can be scoped to a campus.
    InstitutionsModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
