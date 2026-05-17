import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/erranders';

async function run() {
  // Explicitly connect to 'erranders' database
  await mongoose.connect(uri, { dbName: 'erranders' });
  const db = mongoose.connection.db;

  if (!db) {
    console.error('Failed to connect to DB');
    return;
  }
    
  console.log('Connected to DB:', mongoose.connection.name);

  // 1. Group vendors by storeName
  const vendorDuplicates = await db.collection('vendors').aggregate([
    { $group: { 
        _id: "$storeName", 
        count: { $sum: 1 }, 
        ids: { $push: "$_id" },
        owners: { $push: "$owner" }
    } },
    { $match: { count: { $gt: 1 } } }
  ]).toArray();


  // 2. Find "Orphaned" Orders
  const allVendorDocs = await db.collection('vendors').find({}, { projection: { _id: 1 } }).toArray();
  const allVendorIds = allVendorDocs.map(v => v._id.toString());
  
  const orderGroups = await db.collection('orders').aggregate([
    { $match: { vendor: { $exists: true } } },
    { $group: { _id: "$vendor", count: { $sum: 1 } } }
  ]).toArray();

  const orphanedOrders = orderGroups.filter(o => !allVendorIds.includes(o._id.toString()));

  console.log('\n--- Orders linked to non-existent Vendor IDs ---');
  console.log(JSON.stringify(orphanedOrders, null, 2));

  // 3. Find Vendors with NO orders
  const vendorIdsInOrders = orderGroups.map(o => o._id.toString());
  const vendorsWithNoOrders = allVendorDocs.filter(v => !vendorIdsInOrders.includes(v._id.toString()));
  
  console.log('\n--- Vendors with 0 Orders ---');
  for (const v of vendorsWithNoOrders) {
    const fullVendor = await db.collection('vendors').findOne({ _id: v._id });
    console.log(`- ${fullVendor?.storeName} (${v._id}) [Owner: ${fullVendor?.owner}]`);
  }

  await mongoose.disconnect();
}

run().catch(console.error);
