import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Vendor } from '../src/modules/vendors/schemas/vendor.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const vendorModel = app.get<Model<Vendor>>(getModelToken(Vendor.name));
  
  await vendorModel.updateOne(
    { _id: '6a4e4ba65be2071e52785438' },
    { $set: { businessType: 'food' } }
  );
  
  console.log('Updated Vendor businessType to food');

  await app.close();
  process.exit(0);
}
bootstrap();
