import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { Vendor, VendorSchema } from '../vendors/schemas/vendor.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Service, ServiceSchema } from '../services/schemas/service.schema';
import { MenuItem, MenuItemSchema } from '../menu/schemas/menu-item.schema';
import { InstitutionsModule } from '../institutions/institutions.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Vendor.name, schema: VendorSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Service.name, schema: ServiceSchema },
      { name: MenuItem.name, schema: MenuItemSchema },
    ]),
    // Exports InstitutionResolver so search results can be scoped to a campus.
    InstitutionsModule,
  ],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
