import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const packModel = app.get<Model<any>>(getModelToken('MenuPack'));
    const itemModel = app.get<Model<any>>(getModelToken('MenuItem'));
    const vendorModel = app.get<Model<any>>(getModelToken('Vendor'));

    const vendor = await vendorModel.findOne({ storeName: { $regex: 'Iyabo', $options: 'i' } });

    // Fetch ONLY active items for this vendor (what the API returns to frontend)
    const activeItems = await itemModel.find({ vendorId: vendor._id }).sort({ createdAt: -1 });
    
    // Find the newest version of each item
    const getNewestItem = (name: string) => {
        return activeItems.find(i => i.name.toLowerCase().includes(name.toLowerCase()));
    };

    const plantain = getNewestItem('Plantain');
    const egg = getNewestItem('Egg');
    const bread = getNewestItem('Bread');
    const beans = getNewestItem('Beans');
    const beef = getNewestItem('Beef');

    const comboId = '6a8b022a9a228e463a9365a2'; 
    const pack = await packModel.findById(comboId);
    
    if (pack) {
      const components: any[] = [];
      if (plantain) components.push({ itemId: plantain._id, portions: 1 });
      if (egg) components.push({ itemId: egg._id, portions: 1 });
      if (bread) components.push({ itemId: bread._id, portions: 1 });
      if (beans) components.push({ itemId: beans._id, portions: 1 });
      if (beef) components.push({ itemId: beef._id, portions: 1 });
      
      pack.components = components;
      await pack.save();
      console.log('Fixed combo to use the newest ACTIVE item IDs.');
      console.log(components.map(c => c.itemId.toString()));
    }

  } catch (e) {
    console.log(e);
  }
  
  await app.close();
}
bootstrap();
