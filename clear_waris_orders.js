const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const vendor = await mongoose.connection.collection('vendors').findOne({
    storeName: { $regex: /waris/i }
  });

  if (!vendor) {
    console.log('Vendor Waris Kitchen not found');
    process.exit(1);
  }

  const result = await mongoose.connection.collection('orders').deleteMany({ vendor: vendor._id });
  
  console.log(`Cleared ${result.deletedCount} orders for ${vendor.storeName}`);
  await mongoose.disconnect();
}

run().catch(console.error);
