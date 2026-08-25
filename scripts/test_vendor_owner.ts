import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  try {
    const VendorModel = app.get<Model<any>>(getModelToken('Vendor'));
    const vendor = await VendorModel.findById('6a89dd8efafcc95c3a312edf');
    
    console.log('Vendor Owner:', vendor?.owner);
    console.log('Is null?', vendor?.owner === null);
    console.log('Is undefined?', vendor?.owner === undefined);
    
    try {
      const vOwnerId = ((vendor.owner as any)?._id || vendor.owner).toString();
      console.log('vOwnerId:', vOwnerId);
    } catch (e) {
      console.error('Error on toString:', e.message);
    }

  } catch (error) {
    console.error('Script failed:', error);
  } finally {
    await app.close();
  }
}
bootstrap();
