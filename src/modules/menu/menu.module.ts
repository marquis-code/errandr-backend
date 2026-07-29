import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

// Schemas
import { MenuCategory, MenuCategorySchema } from './schemas/menu-category.schema';
import { Modifier, ModifierSchema } from './schemas/modifier.schema';
import { AddOnGroup, AddOnGroupSchema } from './schemas/add-on.schema';
import { MenuPack, MenuPackSchema } from './schemas/menu-pack.schema';
import { MenuItem, MenuItemSchema } from './schemas/menu-item.schema';
import { ItemRestockRequest, ItemRestockRequestSchema } from './schemas/item-restock-request.schema';
import { SystemSetting, SystemSettingSchema } from '../admin/schemas/system-setting.schema';

// Services
import { MenuCategoryService } from './menu-category.service';
import { ModifierService } from './modifier.service';
import { AddOnService } from './add-on.service';
import { MenuPackService } from './menu-pack.service';
import { MenuItemService } from './menu-item.service';
import { CartCalculationService } from './cart-calculation.service';

// Controllers
import { MenuCategoryController } from './menu-category.controller';
import { ModifierController } from './modifier.controller';
import { AddOnController } from './add-on.controller';
import { MenuPackController } from './menu-pack.controller';
import { MenuItemController } from './menu-item.controller';

// Vendor schema needed for food-vendor checks in services
import { VendorsModule } from '../vendors/vendors.module';
import { GlobalProductsModule } from '../global-products/global-products.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MenuCategory.name, schema: MenuCategorySchema },
      { name: Modifier.name, schema: ModifierSchema },
      { name: AddOnGroup.name, schema: AddOnGroupSchema },
      { name: MenuPack.name, schema: MenuPackSchema },
      { name: MenuItem.name, schema: MenuItemSchema },
      { name: ItemRestockRequest.name, schema: ItemRestockRequestSchema },
      { name: SystemSetting.name, schema: SystemSettingSchema },
    ]),
    VendorsModule,
    GlobalProductsModule,
  ],
  controllers: [
    MenuCategoryController,
    ModifierController,
    AddOnController,
    MenuPackController,
    MenuItemController,
  ],
  providers: [
    MenuCategoryService,
    ModifierService,
    AddOnService,
    MenuPackService,
    MenuItemService,
    CartCalculationService,
  ],
  exports: [
    MenuItemService,
    MenuCategoryService,
    ModifierService,
    AddOnService,
    MenuPackService,
    CartCalculationService,
  ],
})
export class MenuModule {}
