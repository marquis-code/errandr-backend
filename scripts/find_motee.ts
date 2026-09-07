import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Vendor } from '../src/modules/vendors/schemas/vendor.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const vendorModel = app.get<Model<Vendor>>(getModelToken(Vendor.name));

  const vendors = await vendorModel.find({ storeName: /motee/i });
  console.log('Found vendors:', vendors.map(v => v.storeName));

  await app.close();
  process.exit(0);
}
bootstrap();
