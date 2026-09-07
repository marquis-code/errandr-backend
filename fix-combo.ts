import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const packModel = app.get<Model<any>>(getModelToken('MenuPack'));

    const comboId = '6a8b022a9a228e463a9365a2'; // from the previous log
    const pack = await packModel.findById(comboId);
    
    if (pack) {
      // Add Beans and Beef manually using the known IDs
      const components = pack.components || [];
      const hasBeans = components.some(c => c.itemId.toString() === '6a81583011fb20dd60e65d1c');
      const hasBeef = components.some(c => c.itemId.toString() === '6a81583111fb20dd60e65d39');
      
      if (!hasBeans) {
        components.push({ itemId: new Types.ObjectId('6a81583011fb20dd60e65d1c'), portions: 1 });
      }
      if (!hasBeef) {
        components.push({ itemId: new Types.ObjectId('6a81583111fb20dd60e65d39'), portions: 1 });
      }
      
      pack.components = components;
      await pack.save();
      console.log('Fixed combo to include Beans and Beef.');
    } else {
      console.log('Combo not found');
    }

  } catch (e) {
    console.log(e);
  }
  
  await app.close();
}
bootstrap();
