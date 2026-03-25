import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Vendor } from '../src/modules/vendors/schemas/vendor.schema';
import { Order } from '../src/modules/orders/schemas/order.schema';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const vendorModel = app.get<Model<Vendor>>(getModelToken(Vendor.name));
  const orderModel = app.get<Model<Order>>(getModelToken(Order.name));

  console.log('--- ORDER OWNERSHIP ANALYSIS ---');

  const ordersByVendor = await orderModel.aggregate([
    { $group: { _id: "$vendor", count: { $sum: 1 } } }
  ]);

  for (const group of ordersByVendor) {
    const vendorId = group._id;
    if (!vendorId) {
      console.log(`- Orders with NULL vendor: ${group.count}`);
      continue;
    }

    const vendor = await vendorModel.findById(vendorId).select('storeName owner').lean();
    if (vendor) {
      console.log(`- Vendor: "${vendor.storeName}" (${vendorId}) | Owner: ${vendor.owner} | Orders: ${group.count}`);
    } else {
      console.log(`- DELETED Vendor (${vendorId}) | Orders: ${group.count}`);
    }
  }

  console.log('\n--- VENDORS WITH 0 ORDERS ---');
  const allVendors = await vendorModel.find().select('storeName owner').lean();
  for (const v of allVendors) {
    const count = await orderModel.countDocuments({ vendor: v._id });
    if (count === 0) {
      console.log(`- Vendor: "${v.storeName}" (${v._id}) | Owner: ${v.owner}`);
    }
  }

  await app.close();
}

run().catch(console.error);
