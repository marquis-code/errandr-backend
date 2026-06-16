import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Vendor } from '../src/modules/vendors/schemas/vendor.schema';
import { Order } from '../src/modules/orders/schemas/order.schema';
import { Product } from '../src/modules/products/schemas/product.schema';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const vendorModel = app.get<Model<Vendor>>(getModelToken(Vendor.name));
  const orderModel = app.get<Model<Order>>(getModelToken(Order.name));
  const productModel = app.get<Model<Product>>(getModelToken(Product.name));


  const duplicates = await vendorModel.aggregate([
    { $group: { 
        _id: "$storeName", 
        count: { $sum: 1 }, 
        ids: { $push: "$_id" },
        owners: { $push: "$owner" }
    } },
    { $match: { count: { $gt: 1 } } }
  ]);

  console.log(`Found ${duplicates.length} duplicate store names.`);

  for (const dup of duplicates) {
    console.log(`\nStore: "${dup._id}"`);
    for (let i = 0; i < dup.ids.length; i++) {
      const vid = dup.ids[i];
      const owner = dup.owners[i];
      const orderCount = await orderModel.countDocuments({ vendor: vid });
      const productCount = await productModel.countDocuments({ vendor: vid });
    }
  }

  // Also check for orphaned orders (vendor ID not in vendors collection)
  const allVendorIds = (await vendorModel.find({}, { _id: 1 })).map(v => v._id.toString());
  const allOrderVendorIds = await orderModel.distinct('vendor');
  const orphans = allOrderVendorIds.filter(id => id && !allVendorIds.includes(id.toString()));

  console.log(`\nFound ${orphans.length} orphaned vendor IDs in Orders.`);
  for (const orphanId of orphans) {
    const count = await orderModel.countDocuments({ vendor: orphanId });
    console.log(`  - Orphaned Vendor ID: ${orphanId} | Orders: ${count}`);
  }

  await app.close();
}

run().catch(console.error);
