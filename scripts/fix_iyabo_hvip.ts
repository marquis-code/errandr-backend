import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Vendor } from '../src/modules/vendors/schemas/vendor.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const vendorModel = app.get<Model<Vendor>>(getModelToken(Vendor.name));

  const hvip = await vendorModel.findOne({ storeName: /hvip/i });
  if (hvip && hvip.prepaidPromo) {
    hvip.prepaidPromo.budgetPerOrder = 2000;
    hvip.markModified('prepaidPromo');
    await hvip.save();
    console.log('Fixed HVIP');
  }

  const iyabo = await vendorModel.findOne({ storeName: /iyabo/i });
  if (iyabo && iyabo.prepaidPromo) {
    iyabo.prepaidPromo.budgetPerOrder = 2000;
    iyabo.markModified('prepaidPromo');
    await iyabo.save();
    console.log('Fixed Iyabo');
  }

  await app.close();
  process.exit(0);
}
bootstrap();
