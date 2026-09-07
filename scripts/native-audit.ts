import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Vendor } from '../src/modules/vendors/schemas/vendor.schema';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const vendorModel = app.get<Model<Vendor>>(getModelToken(Vendor.name));

  console.log('--- AUDIT START ---');
  const count = await vendorModel.countDocuments();
  console.log(`Total vendors: ${count}`);

  if (count > 0) {
    const vendors = await vendorModel.find().limit(5).select('storeName owner').lean();
    console.log('Sample Vendors:', JSON.stringify(vendors, null, 2));
  }

  await app.close();
}

run().catch(console.error);
