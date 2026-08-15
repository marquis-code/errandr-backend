const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const vendors = mongoose.connection.collection('vendors');

  await vendors.updateOne(
    { storeName: /HVIP/i },
    { $set: { businessType: 'physical_product' } }
  );

  console.log('HVIP FOODS businessType fixed to physical_product');
  process.exit(0);
}
run().catch(console.error);
