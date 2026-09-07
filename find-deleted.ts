import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const packModel = app.get<Model<any>>(getModelToken('MenuPack'));
    const packs = await packModel.find({}).populate('vendorId');
    console.log(`Found ${packs.length} packs in DB`);
    for (const p of packs) {
      if (p.vendorId && (p.vendorId.storeName.includes('Iyabo') || p.name.includes('Iyabo') || p.name.includes('commbo') || p.name.includes('combo'))) {
        console.log(`Pack: ${p.name}, Vendor: ${p.vendorId.storeName}, ID: ${p._id}`);
      }
    }
  } catch (e) {
    console.log(e);
  }
  
  await app.close();
}
bootstrap();
