import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Vendor } from '../src/modules/vendors/schemas/vendor.schema';
import { Product } from '../src/modules/products/schemas/product.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const vendorModel = app.get<Model<Vendor>>(getModelToken(Vendor.name));
  const productModel = app.get<Model<Product>>(getModelToken(Product.name));

  const vendorId = '69bed22cce3c828e98beb438';
  const newOwnerId = '69bf1be57bd24adc3fce8de6';

  const vendor = await vendorModel.findByIdAndUpdate(vendorId, { owner: new Types.ObjectId(newOwnerId) });
  console.log('Fixed vendor:', vendor ? 'SUCCESS' : 'NOT FOUND');

  const productsResult = await productModel.updateMany(
    { vendor: new Types.ObjectId(vendorId) },
    { $set: { owner: new Types.ObjectId(newOwnerId) } }
  );
  console.log('Fixed products count:', productsResult.modifiedCount);

  await app.close();
  process.exit(0);
}
bootstrap();
