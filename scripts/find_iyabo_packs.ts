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

  const iyabo = await vendorModel.findOne({ storeName: /iyabo/i });
  if (iyabo) {
    const packs = await packModel.find({ vendorId: iyabo._id, isPrepaidByPlatform: true });
    console.log('Iyabo Prepaid Packs:', packs.map(p => p.name));
  } else {
    console.log('Iyabo not found');
  }

  await app.close();
  process.exit(0);
}
bootstrap();
