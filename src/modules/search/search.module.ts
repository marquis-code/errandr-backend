import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { Vendor, VendorSchema } from '../vendors/schemas/vendor.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Service, ServiceSchema } from '../services/schemas/service.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Vendor.name, schema: VendorSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Service.name, schema: ServiceSchema },
    ]),
  ],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
