import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Vendor } from '../src/modules/vendors/schemas/vendor.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const vendorModel = app.get<Model<Vendor>>(getModelToken(Vendor.name));

  const waris = await vendorModel.findOne({ storeName: /waris/i });
  if (waris && waris.prepaidPromo) {
    waris.prepaidPromo.budgetPerOrder = 2000;
    await waris.save();
    console.log('Successfully updated budgetPerOrder for Waris to 2000');
  }

  await app.close();
  process.exit(0);
}
bootstrap();
