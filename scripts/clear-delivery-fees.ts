import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Vendor } from '../src/modules/vendors/schemas/vendor.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const vendorModel = app.get<Model<Vendor>>(getModelToken(Vendor.name));

  console.log('Starting migration: Aggressively clearing delivery fees from all vendors...');
  
  const result = await vendorModel.updateMany(
    {},
    {
      $unset: {
        deliveryFee: "",
        baseDeliveryFee: ""
      }
    }
  );

  console.log(`Migration complete. Modified ${result.modifiedCount} vendors.`);
  
  await app.close();
}

bootstrap();
