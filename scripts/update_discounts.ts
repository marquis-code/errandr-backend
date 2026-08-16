import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Vendor } from '../src/modules/vendors/schemas/vendor.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const vendorModel = app.get<Model<Vendor>>(getModelToken(Vendor.name));

  const motee = await vendorModel.findOne({ storeName: /motee/i });
  if (motee && motee.prepaidPromo) {
    motee.prepaidPromo.discountValue = 500;
    await motee.save();
    console.log('Successfully updated discount for Motee');
  }

  const waris = await vendorModel.findOne({ storeName: /waris/i });
  if (waris && waris.prepaidPromo) {
    waris.prepaidPromo.discountValue = 1000;
    await waris.save();
    console.log('Successfully updated discount for Waris');
  }

  await app.close();
  process.exit(0);
}
bootstrap();
