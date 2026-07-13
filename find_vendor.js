const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/.env' });

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const vendors = await db.collection('vendors').find({ storeName: { $regex: /voyage/i } }).toArray();
  if (vendors.length === 0) {
    const allVendors = await db.collection('vendors').find({}, { projection: { storeName: 1 } }).toArray();
    console.log('All vendors:', allVendors);
  } else {
    console.log('Found vendor:', vendors[0]._id, vendors[0].storeName);
  }
  await mongoose.disconnect();
}
main().catch(console.error);
