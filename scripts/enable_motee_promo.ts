import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Vendor } from '../src/modules/vendors/schemas/vendor.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const vendorModel = app.get<Model<Vendor>>(getModelToken(Vendor.name));

  const motee = await vendorModel.findOne({ storeName: /motee/i });
  if (motee) {
    motee.prepaidPromo = {
      enabled: true,
      budgetPerOrder: 0,
      maxOrders: 10,
      usedOrders: 0,
      label: 'Exam Combo',
    };
    await motee.save();
    console.log('Successfully enabled Exam Combo promo for Chips by Motee');
  } else {
    console.log('Chips by Motee not found');
  }

  await app.close();
  process.exit(0);
}
bootstrap();
