import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { VendorsService } from '../src/modules/vendors/vendors.service';
import { Types } from 'mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const vendorsService = app.get(VendorsService);
  
  try {
    const vendor = await vendorsService.findById('6a6dbd87127e11af510ac0cd');
    console.log('Vendor found:', vendor ? vendor._id : 'Not found');
  } catch (e) {
    console.log('Error:', e.message);
  }
  
  // Also list some vendors
  const anyVendors = await (vendorsService as any).vendorModel.find().limit(2);
  console.log('Some vendors in DB:', anyVendors.map(v => v._id));
  
  await app.close();
}
bootstrap();
