import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product } from '../src/modules/products/schemas/product.schema';
import { Vendor } from '../src/modules/vendors/schemas/vendor.schema';
import { User } from '../src/modules/users/schemas/user.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const productModel = app.get<Model<Product>>(getModelToken(Product.name));
  const vendorModel = app.get<Model<Vendor>>(getModelToken(Vendor.name));
  const userModel = app.get<Model<User>>(getModelToken(User.name));

  const user = await userModel.findOne({ email: 'blessingidowu1991@gmail.com' });
  if (!user) {
    console.log('User not found');
    process.exit(0);
  }
  console.log('User ID:', user._id);

  const vendor = await vendorModel.findOne({ owner: user._id });
  if (!vendor) {
    console.log('Vendor not found for user');
    process.exit(0);
  }
  console.log('Vendor ID:', vendor._id, 'Store Name:', vendor.storeName);

  const productsByVendor = await productModel.find({ vendor: vendor._id });
  console.log(`Found ${productsByVendor.length} products by vendor (${vendor._id})`);

  // Let's also check if there are products with storeName or something else, or if the student app fetches by owner ID instead of vendor ID
  const allProducts = await productModel.find();
  const iyaboProducts = allProducts.filter(p => p.name?.toLowerCase().includes('plantain') || p.vendor?.toString() === vendor._id.toString());
  
  console.log('Products that might belong to her:', iyaboProducts.map(p => ({
    name: p.name,
    vendor: p.vendor,
    id: p._id
  })));

  await app.close();
  process.exit(0);
}
bootstrap();
