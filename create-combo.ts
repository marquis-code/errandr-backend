import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const vendorModel = app.get<Model<any>>(getModelToken('Vendor'));
    const itemModel = app.get<Model<any>>(getModelToken('MenuItem'));
    const packModel = app.get<Model<any>>(getModelToken('MenuPack'));
    const categoryModel = app.get<Model<any>>(getModelToken('MenuCategory'));
    const addOnGroupModel = app.get<Model<any>>(getModelToken('AddOnGroup'));

    const vendor = await vendorModel.findOne({ storeName: { $regex: 'Iyabo', $options: 'i' } });
    if (!vendor) {
      console.log('Vendor not found');
      return;
    }

    let category = await categoryModel.findOne({ vendorId: vendor._id, name: 'Combos' });
    if (!category) {
      category = await categoryModel.create({
        name: 'Combos',
        vendorId: vendor._id,
        isAvailable: true
      });
    }

    const itemsToFind = ['Beans', 'Plantain', 'Egg', 'Beef', 'Bread'];
    const components: any[] = [];
    for (const itemName of itemsToFind) {
      const item = await itemModel.findOne({ vendorId: vendor._id, name: { $regex: itemName, $options: 'i' } });
      if (item) {
        components.push({
          itemId: item._id,
          portions: 1
        });
        console.log(`Found item ${item.name} (${item._id})`);
      } else {
        console.log(`Warning: Item ${itemName} not found for vendor`);
      }
    }

    // See if there's a takeaway addon
    const addons = await addOnGroupModel.find({ vendorId: vendor._id });
    let takeawayId = null;
    for (const addon of addons) {
      if (addon.name.toLowerCase().includes('takeaway')) {
        takeawayId = addon._id;
        console.log(`Found takeaway addon: ${addon.name} (${addon._id})`);
      }
    }

    const comboData = {
      name: 'Exam Combo',
      description: 'Special promo combo for students. Get massive discounts instantly at checkout!',
      categoryId: category._id,
      vendorId: vendor._id,
      components: components,
      bundlePrice: 1500,
      addOnGroupIds: takeawayId ? [takeawayId] : [],
      isAvailable: true,
      isPrepaidByPlatform: true,
      trackStock: false,
      isPackagingFeeIncluded: false
    };

    const newPack = await packModel.create(comboData);
    console.log(`Successfully created combo: ${newPack.name} with ID: ${newPack._id}`);

  } catch (e) {
    console.log(e);
  }
  
  await app.close();
}
bootstrap();
