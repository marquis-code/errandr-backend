const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const vendors = mongoose.connection.collection('vendors');

  const waris = await vendors.findOne({ storeName: /waris/i });
  const hvip = await vendors.findOne({ storeName: /HVIP/i });

  console.log('--- WARIS KITCHEN ---');
  console.log('vendorType:', waris?.vendorType);
  console.log('categories:', waris?.categories);
  console.log('isMiniMart:', waris?.isMiniMart);
  console.log('storeName:', waris?.storeName);
  
  console.log('\n--- HVIP FOODS ---');
  console.log('vendorType:', hvip?.vendorType);
  console.log('categories:', hvip?.categories);
  console.log('isMiniMart:', hvip?.isMiniMart);
  console.log('storeName:', hvip?.storeName);

  process.exit(0);
}
run().catch(console.error);
