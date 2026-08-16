import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product } from '../src/modules/products/schemas/product.schema';
import { Vendor } from '../src/modules/vendors/schemas/vendor.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const productModel = app.get<Model<Product>>(getModelToken(Product.name));
  const vendorModel = app.get<Model<Vendor>>(getModelToken(Vendor.name));

  const iyabo = await vendorModel.findOne({ storeName: /iyabo/i });
  if (iyabo) {
    const products = await productModel.find({ vendorId: iyabo._id });
    console.log('Iyabo Products:', products.map(p => ({ name: p.name, price: p.price, isPrepaid: (p as any).isPrepaidByPlatform })));
  }

  await app.close();
  process.exit(0);
}
bootstrap();
