import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MenuItem } from '../src/modules/menu/schemas/menu-item.schema';
import { MenuCategory } from '../src/modules/menu/schemas/menu-category.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const menuCategoryModel = app.get<Model<MenuCategory>>(getModelToken(MenuCategory.name));
  const menuItemModel = app.get<Model<MenuItem>>(getModelToken(MenuItem.name));

  const vendorIdStr = '6a4e4d975be2071e5278568c';
  const vendorId = new Types.ObjectId(vendorIdStr);

  const menuData = [
    {
      category: 'MAIN DISHES',
      items: [
        { name: 'Jollof Spaghetti & Turkey (Standard)', price: 3000 },
        { name: 'Jollof Spaghetti & Turkey (Premium)', price: 3500 },
        { name: 'Spaghetti, Chips & Turkey (Standard)', price: 4000 },
        { name: 'Spaghetti, Chips & Turkey (Premium)', price: 4500 },
        { name: 'Spaghetti (Without Turkey) (Standard)', price: 1000 },
        { name: 'Spaghetti (Without Turkey) (Premium)', price: 1500 },
      ],
    },
    {
      category: 'RICE DISHES',
      items: [
        { name: 'Suya Rice', price: 300 },
        { name: 'Coconut Rice', price: 300 },
        { name: 'Basmati Rice', price: 400 },
      ],
    },
    {
      category: 'PROTEIN & SIDES',
      items: [
        { name: 'Grilled Turkey', price: 2000 },
        { name: 'Beef', price: 200 },
        { name: 'Eggs', price: 300 },
        { name: 'Plantain (Portion)', price: 200 },
      ],
    },
  ];

  for (const section of menuData) {
    let cat = await menuCategoryModel.findOne({ vendorId, name: section.category });
    if (!cat) {
      cat = await menuCategoryModel.create({
        vendorId,
        name: section.category,
        sortOrder: 0,
        isActive: true,
      });
      console.log(`Created category: ${section.category}`);
    } else {
      console.log(`Found category: ${section.category}`);
    }

    for (const item of section.items) {
      const existing = await menuItemModel.findOne({ vendorId, name: item.name });
      if (!existing) {
        await menuItemModel.create({
          vendorId,
          categoryId: cat._id,
          name: item.name,
          pricePerPortion: item.price,
          portionUnit: 'plate',
          isAvailable: true,
        });
        console.log(`  Added item: ${item.name} - ₦${item.price}`);
      } else {
        console.log(`  Item exists: ${item.name}`);
      }
    }
  }

  console.log('Seeding complete.');
  await app.close();
  process.exit(0);
}

bootstrap();
