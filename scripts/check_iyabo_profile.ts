import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Vendor } from '../src/modules/vendors/schemas/vendor.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const vendorModel = app.get<Model<Vendor>>(getModelToken(Vendor.name));
  
  const vendor = await vendorModel.findById('6a4e4ba65be2071e52785438');
  console.log('Vendor profile:');
  console.log('storeName:', vendor?.storeName);
  console.log('category:', vendor?.category);
  console.log('businessType:', vendor?.businessType);
  console.log('tags:', vendor?.tags);
  
  await app.close();
  process.exit(0);
}
bootstrap();
