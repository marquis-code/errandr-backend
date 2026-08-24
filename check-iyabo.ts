import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const vendorModel = app.get<Model<any>>(getModelToken('Vendor'));
    const vendors = await vendorModel.find({ storeName: { $regex: 'Iyabo', $options: 'i' } });
    for (const v of vendors) {
      console.log(`Vendor: ${v.storeName} (ID: ${v._id})`);
    }
  } catch (e) {
    console.log(e);
  }
  await app.close();
}
bootstrap();
