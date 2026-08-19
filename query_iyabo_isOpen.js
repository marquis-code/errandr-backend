const mongoose = require('mongoose');
require('dotenv').config();
async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const iyabo = await db.collection('vendors').findOne({ storeName: /iyabo/i });
  console.log('isOpen in DB:', iyabo.isOpen);
  await mongoose.disconnect();
}
run().catch(console.error);
