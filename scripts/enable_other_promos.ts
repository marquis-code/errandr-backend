import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Vendor } from '../src/modules/vendors/schemas/vendor.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const vendorModel = app.get<Model<Vendor>>(getModelToken(Vendor.name));

  const hvip = await vendorModel.findOne({ storeName: /hvip/i });
  if (hvip) {
    hvip.prepaidPromo = {
      enabled: true,
      budgetPerOrder: 0,
      maxOrders: 20,
      usedOrders: 0,
      label: 'Exam Combo',
      discountValue: 1000
    };
    await hvip.save();
    console.log('Successfully enabled Exam Combo promo for HVIP');
  }

  const iyabo = await vendorModel.findOne({ storeName: /iyabo/i });
  if (iyabo) {
    iyabo.prepaidPromo = {
      enabled: true,
      budgetPerOrder: 0,
      maxOrders: 20,
      usedOrders: 0,
      label: 'Exam Combo',
      discountValue: 1000
    };
    await iyabo.save();
    console.log('Successfully enabled Exam Combo promo for Iyabo');
  }

  await app.close();
  process.exit(0);
}
bootstrap();
