import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Vendor } from '../src/modules/vendors/schemas/vendor.schema';
import { Order } from '../src/modules/orders/schemas/order.schema';
import { Product } from '../src/modules/products/schemas/product.schema';

/**
 * GLOBAL VENDOR MERGE SCRIPT
 * 
 * This script identifies duplicate or slightly mismatched vendor records 
 * and merges them into a single authoritative record.
 */

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const vendorModel = app.get<Model<Vendor>>(getModelToken(Vendor.name));
  const orderModel = app.get<Model<Order>>(getModelToken(Order.name));
  const productModel = app.get<Model<Product>>(getModelToken(Product.name));

  console.log('--- STARTING GLOBAL VENDOR MERGE ---');

  const allVendors = await vendorModel.find().lean();
  
  // Normalize names for grouping
  // 1. Lowercase
  // 2. Remove all non-alphanumeric characters
  // 3. Manual map for known typos (Chikoke vs Chijoke)
  const normalize = (name: string) => {
    let n = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (n === 'chijoke') return 'chikoke'; // Manual override for the user's reported case
    return n;
  };

  const groups: Record<string, any[]> = {};
  for (const v of allVendors) {
    const key = normalize(v.storeName);
    if (!groups[key]) groups[key] = [];
    groups[key].push(v);
  }

  for (const [key, members] of Object.entries(groups)) {
    if (members.length < 2) continue;

    console.log(`\nProcessing Group: "${key}" (${members.length} records)`);
    
    // 1. Identify "Authoritative" record (the one with orders)
    let authoritativeRecord: any = null;
    let maxOrders = -1;
    
    // Also track who the "best" owner is (typically the one linked to a record created later or with data)
    let activeOwnerId: any = null;

    for (const m of members) {
      const orderCount = await orderModel.countDocuments({ vendor: m._id });
      console.log(`  - Record ${m._id} | Name: "${m.storeName}" | Owner: ${m.owner} | Orders: ${orderCount}`);
      
      if (orderCount > maxOrders) {
        maxOrders = orderCount;
        authoritativeRecord = m;
      }

      // If this record was the one the user was actually logged into recently (e.g. Chijoke)
      // we prefer its owner if the other one looks placeholder-ish
      if (m.storeName === 'Chijoke') {
         activeOwnerId = m.owner;
      }
    }

    if (!authoritativeRecord) continue;
    
    // If we found a specific "active" owner (like the user who just logged in), 
    // ensure the authoritative record is owned by them.
    if (activeOwnerId && !authoritativeRecord.owner.equals(activeOwnerId)) {
      console.log(`  ! Updating authoritative record ${authoritativeRecord._id} owner to ${activeOwnerId}`);
      await vendorModel.updateOne({ _id: authoritativeRecord._id }, { $set: { owner: activeOwnerId } });
    }

    // 2. Migrate others to authoritative
    for (const m of members) {
      if (m._id.equals(authoritativeRecord._id)) continue;

      console.log(`  > Migrating data from ${m._id} to ${authoritativeRecord._id}...`);
      
      const orderRes = await orderModel.updateMany({ vendor: m._id }, { $set: { vendor: authoritativeRecord._id } });
      const productRes = await productModel.updateMany({ vendor: m._id }, { $set: { vendor: authoritativeRecord._id } });
      
      console.log(`    Updated ${orderRes.modifiedCount} orders and ${productRes.modifiedCount} products.`);
      
      // 3. Delete the redundant record
      console.log(`    Deleting redundant record ${m._id}...`);
      await vendorModel.deleteOne({ _id: m._id });
    }
  }

  console.log('\n--- MERGE COMPLETE ---');
  await app.close();
}

run().catch(console.error);
