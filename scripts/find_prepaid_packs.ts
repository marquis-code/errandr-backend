import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Pack } from '../src/modules/products/schemas/pack.schema';
import { Vendor } from '../src/modules/vendors/schemas/vendor.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const packModel = app.get<Model<Pack>>(getModelToken(Pack.name));
  const vendorModel = app.get<Model<Vendor>>(getModelToken(Vendor.name));

  const packs = await packModel.find({ isPrepaidByPlatform: true }).populate('vendorId', 'storeName');
  console.log('Prepaid Packs:', packs.map(p => ({
    name: p.name,
    vendor: (p.vendorId as any)?.storeName,
    bundlePrice: p.bundlePrice
  })));

  await app.close();
  process.exit(0);
}
bootstrap();
