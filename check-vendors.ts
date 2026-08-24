import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const itemModel = app.get<Model<any>>(getModelToken('MenuItem'));
    const plantain = await itemModel.findById('6a67a089f590d198be2bf768').populate('vendorId');
    const newBeans = await itemModel.findById('6a81583011fb20dd60e65d1c').populate('vendorId');
    
    console.log('Old Plantain:', plantain?.name, 'Vendor:', plantain?.vendorId?.storeName, 'VendorID:', plantain?.vendorId?._id);
    console.log('New Beans:', newBeans?.name, 'Vendor:', newBeans?.vendorId?.storeName, 'VendorID:', newBeans?.vendorId?._id);
  } catch (e) {
    console.log(e);
  }
  await app.close();
}
bootstrap();
