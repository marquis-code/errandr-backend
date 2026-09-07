import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const itemModel = app.get<Model<any>>(getModelToken('MenuItem'));
    const items = await itemModel.find({}).populate('vendorId');
    for (const p of items) {
      if (p.vendorId && (p.vendorId.storeName.includes('Iyabo') || p.name.includes('Iyabo') || p.name.includes('combo') || p.name.includes('commbo'))) {
        console.log(`Item: ${p.name}, Vendor: ${p.vendorId.storeName}, ID: ${p._id}`);
      }
    }
  } catch (e) {
    console.log(e);
  }
  
  await app.close();
}
bootstrap();
