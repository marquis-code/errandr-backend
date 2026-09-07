import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product } from '../src/modules/products/schemas/product.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const productModel = app.get<Model<Product>>(getModelToken(Product.name));
  
  const products = await productModel.find({ vendor: '6a26d084fe9ee523f5e1280c' });
  console.log('Products for unknown vendor 6a26d084fe9ee523f5e1280c:', products.map(p => p.name));
  
  // If these are Iyabo's products, we should update their vendor ID to Iyabo's correct vendor ID (6a4e4ba65be2071e52785438)
  const iyaboVendorId = '6a4e4ba65be2071e52785438';
  const result = await productModel.updateMany(
    { vendor: '6a26d084fe9ee523f5e1280c' },
    { $set: { vendor: iyaboVendorId } }
  );
  
  console.log(`Updated ${result.modifiedCount} products to Iyabo's vendor ID.`);

  await app.close();
  process.exit(0);
}
bootstrap();
