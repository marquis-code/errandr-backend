const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const vendor = await mongoose.connection.collection('vendors').findOne({
    storeName: { $regex: /waris/i }
  });

  if (!vendor) {
    console.log('Vendor Waris Kitchen not found');
  } else {
    console.log('Found vendor:', vendor.storeName, vendor._id);
  }

  await mongoose.disconnect();
}

run().catch(console.error);
