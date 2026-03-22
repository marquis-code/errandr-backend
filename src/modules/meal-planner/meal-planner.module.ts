import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MealPlannerService } from './meal-planner.service';
import { MealPlannerController } from './meal-planner.controller';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Vendor, VendorSchema } from '../vendors/schemas/vendor.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Vendor.name, schema: VendorSchema },
    ]),
  ],
  controllers: [MealPlannerController],
  providers: [MealPlannerService],
  exports: [MealPlannerService],
})
export class MealPlannerModule {}
