import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const VendorModel = app.get<Model<any>>(getModelToken('Vendor'));
  
  const vendor: any = await VendorModel.findOne().populate('owner');
  console.log(JSON.stringify(vendor, null, 2));
  
  await app.close();
}

bootstrap();
