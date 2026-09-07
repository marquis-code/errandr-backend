import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { VendorsService } from '../src/modules/vendors/vendors.service';
import { Types } from 'mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const vendorsService = app.get(VendorsService);
  
  try {
    const vendors = await (vendorsService as any).vendorModel.find({ owner: new Types.ObjectId('6a6dbd87127e11af510ac0cd') });
    console.log('Vendors for this user:', vendors.map(v => v._id));
  } catch (e) {
    console.log('Error:', e.message);
  }
  
  await app.close();
}
bootstrap();
