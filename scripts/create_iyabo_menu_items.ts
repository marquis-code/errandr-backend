import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MenuItem } from '../src/modules/menu/schemas/menu-item.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const menuItemModel = app.get<Model<MenuItem>>(getModelToken(MenuItem.name));
  
  const iyaboVendorId = '6a4e4ba65be2071e52785438';
  // Use the "Beans" category ID that was seen in her combo pack
  const categoryId = '6a5fd4d409aedcd6e4527929'; 

  const items = [
    { name: 'Beans', pricePerPortion: 200, portionUnit: 'spoon' },
    { name: 'Egg', pricePerPortion: 150, portionUnit: 'piece' },
    { name: 'Beef', pricePerPortion: 300, portionUnit: 'piece' },
    { name: 'Bread', pricePerPortion: 150, portionUnit: 'loaf' },
    { name: 'Plantain', pricePerPortion: 200, portionUnit: 'portion' },
    { name: 'Agege Bread', pricePerPortion: 150, portionUnit: 'loaf' }
  ];

  for (const item of items) {
    const existing = await menuItemModel.findOne({ vendorId: iyaboVendorId, name: item.name });
    if (!existing) {
      await menuItemModel.create({
        name: item.name,
        pricePerPortion: item.pricePerPortion,
        portionUnit: item.portionUnit,
        vendorId: iyaboVendorId,
        categoryId: categoryId,
        isAvailable: true,
        trackStock: false,
      });
      console.log(`Created ${item.name} @ ₦${item.pricePerPortion}`);
    } else {
      console.log(`${item.name} already exists.`);
    }
  }

  await app.close();
  process.exit(0);
}
bootstrap();
