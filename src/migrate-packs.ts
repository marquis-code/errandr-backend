import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MenuPack } from './modules/menu/schemas/menu-pack.schema';
import { MenuItem } from './modules/menu/schemas/menu-item.schema';
import { MenuCategory } from './modules/menu/schemas/menu-category.schema';
import { Vendor } from './modules/vendors/schemas/vendor.schema';
import { User } from './modules/users/schemas/user.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const menuPackModel = app.get<Model<MenuPack>>(getModelToken(MenuPack.name));
  const menuItemModel = app.get<Model<MenuItem>>(getModelToken(MenuItem.name));
  const menuCategoryModel = app.get<Model<MenuCategory>>(getModelToken(MenuCategory.name));
  const vendorModel = app.get<Model<Vendor>>(getModelToken(Vendor.name));
  const userModel = app.get<Model<User>>(getModelToken(User.name));

  const emails = ['blessingidowu1991@gmail.com', 'chipsbymotee@vendor.com', 'hvipfoods@vendor.com', 'pontisdor@gmail.com'];

  for (const email of emails) {
    console.log(`Processing vendor: ${email}`);
    const user = await userModel.findOne({ email });
    if (!user) { console.log('User not found'); continue; }
    
    const vendor = await vendorModel.findOne({ owner: user._id });
    if (!vendor) { console.log('Vendor not found'); continue; }

    let category = await menuCategoryModel.findOne({ vendorId: vendor._id });
    if (!category) {
      category = await menuCategoryModel.create({
        vendorId: vendor._id,
        name: 'Combos & Promos',
        description: 'Special offers',
        order: 0,
        isAvailable: true,
      });
      console.log(`Created category ${category._id} for ${vendor.storeName}`);
    }

    const oldCombos = await menuItemModel.find({ vendorId: vendor._id, isPrepaidByPlatform: true });
    
    for (const old of oldCombos) {
      console.log(`Migrating combo: ${old.name}`);
      
      const existingPack = await menuPackModel.findOne({ vendorId: vendor._id, name: old.name });
      if (existingPack) {
        console.log(`Pack already exists: ${existingPack.name}`);
        await menuItemModel.deleteOne({ _id: old._id });
        console.log(`Deleted old menu item: ${old.name}`);
        continue;
      }

      const componentItem = await menuItemModel.create({
        vendorId: vendor._id,
        name: `Component: ${old.name}`,
        description: old.description,
        pricePerPortion: 0,
        price: 0,
        isAvailable: false,
        publishItem: false,
        trackStock: false,
        categoryId: category._id,
      });

      const pack = await menuPackModel.create({
        name: old.name,
        description: old.description,
        categoryId: category._id,
        vendorId: vendor._id,
        components: [
          {
            itemId: componentItem._id,
            portions: 1
          }
        ],
        bundlePrice: old.pricePerPortion || (old as any).price || 0,
        isAvailable: true,
        isPrepaidByPlatform: old.isPrepaidByPlatform,
        trackStock: old.trackStock,
        stockQuantity: old.stockQuantity,
      });
      console.log(`Created MenuPack: ${pack.name}`);

      await menuItemModel.deleteOne({ _id: old._id });
      console.log(`Deleted old menu item: ${old.name}`);
    }
  }

  await app.close();
}
bootstrap();
