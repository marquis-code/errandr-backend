import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MenuItem } from '../src/modules/menu/schemas/menu-item.schema';
import { Vendor } from '../src/modules/vendors/schemas/vendor.schema';
import { Product } from '../src/modules/products/schemas/product.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const menuItemModel = app.get<Model<MenuItem>>(getModelToken(MenuItem.name));
  const productModel = app.get<Model<Product>>(getModelToken(Product.name));
  
  const iyaboVendorId = '6a4e4ba65be2071e52785438';
  
  const menuItems = await menuItemModel.find({ vendorId: iyaboVendorId });
  console.log('MenuItems for Iyabo:', menuItems.map(m => m.name));

  const products = await productModel.find({ vendor: iyaboVendorId });
  console.log('Products for Iyabo:', products.map(p => p.name));

  // Change back the wrongly assigned products
  await productModel.updateMany(
    { vendor: iyaboVendorId, name: { $in: ['Jollof Rice & Chicken', 'Fried Rice & Beef', 'Pounded Yam & Egusi'] } },
    { $set: { vendor: '6a26d084fe9ee523f5e1280c' } }
  );
  console.log('Reverted wrongly assigned products');

  await app.close();
  process.exit(0);
}
bootstrap();
