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

  const iyaboVendor = await vendorModel.findOne({ storeName: /iyabo/i });
  console.log('Found Vendor by name:', iyaboVendor?.storeName, 'ID:', iyaboVendor?._id, 'Owner:', iyaboVendor?.owner);

  const allProducts = await productModel.find();
  
  // Find products that might be iyabo's by name or by the old hardcoded promo logic "Iyabo kitchen"
  const potentialProducts = allProducts.filter(p => p.name?.toLowerCase().includes('iyabo') || p.vendor?.toString() === iyaboVendor?._id?.toString());
  
  console.log('Products for this vendor ID:', potentialProducts.map(p => ({
    name: p.name,
    vendor: p.vendor,
    id: p._id
  })));

  // If no products match, let's look at all products to see if there's a misassigned vendor ID.
  const allVendors = await vendorModel.find();
  const allVendorIds = allVendors.map(v => v._id.toString());
  
  const orphanedProducts = allProducts.filter(p => p.vendor && !allVendorIds.includes(p.vendor.toString()));
  console.log('Orphaned products (vendor ID not in DB):', orphanedProducts.length);
  if (orphanedProducts.length > 0) {
     console.log('Sample orphaned product:', orphanedProducts[0].name, orphanedProducts[0].vendor);
  }

  // Also check if they are global products or something?
  // Let's just print all products and their vendor IDs.
  console.log('All unique vendor IDs in products:');
  const uniqueVendorIds = [...new Set(allProducts.map(p => p.vendor?.toString()))];
  for (const vId of uniqueVendorIds) {
     const v = await vendorModel.findById(vId);
     const count = allProducts.filter(p => p.vendor?.toString() === vId).length;
     console.log(`Vendor ${vId} (${v?.storeName || 'UNKNOWN'}): ${count} products`);
  }

  await app.close();
  process.exit(0);
}
bootstrap();
