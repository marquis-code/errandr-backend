const mongoose = require('mongoose');
require('dotenv').config();
async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const iyabo = await db.collection('vendors').findOne({ storeName: /iyabo/i });
  console.log('Status:', iyabo.status);
  console.log('IsVisible:', iyabo.isVisible);
  console.log('Rating:', iyabo.rating);
  await mongoose.disconnect();
}
run().catch(console.error);
