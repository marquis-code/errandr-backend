const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const vendors = mongoose.connection.collection('vendors');

  const hvip = await vendors.findOne({ storeName: /HVIP/i });
  console.log(JSON.stringify(hvip, null, 2));

  process.exit(0);
}
run().catch(console.error);
