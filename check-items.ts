import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const itemModel = app.get<Model<any>>(getModelToken('MenuItem'));
    const packModel = app.get<Model<any>>(getModelToken('MenuPack'));

    const comboId = '6a8b022a9a228e463a9365a2';
    const pack = await packModel.findById(comboId).populate('components.itemId');
    
    if (pack) {
      console.log('Combo components:');
      for (const comp of pack.components) {
        console.log(`- ${comp.itemId ? comp.itemId.name : 'null (missing item)'} (${comp.itemId ? comp.itemId._id : 'N/A'})`);
      }
    }
  } catch (e) {
    console.log(e);
  }
  
  await app.close();
}
bootstrap();
