import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MealPlannerService } from './meal-planner.service';
import { MealPlannerController } from './meal-planner.controller';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Vendor, VendorSchema } from '../vendors/schemas/vendor.schema';
import { MenuItem, MenuItemSchema } from '../menu/schemas/menu-item.schema';
import { SystemSetting, SystemSettingSchema } from '../admin/schemas/system-setting.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Vendor.name, schema: VendorSchema },
      { name: MenuItem.name, schema: MenuItemSchema },
      { name: SystemSetting.name, schema: SystemSettingSchema },
    ]),
  ],
  controllers: [MealPlannerController],
  providers: [MealPlannerService],
  exports: [MealPlannerService],
})
export class MealPlannerModule {}
