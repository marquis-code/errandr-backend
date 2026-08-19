const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const iyabo = await db.collection('vendors').findOne({ storeName: /iyabo/i });
  console.log(JSON.stringify({ 
    storeName: iyabo.storeName, 
    isOnline: iyabo.isOnline, 
    openingTime: iyabo.openingTime, 
    closingTime: iyabo.closingTime,
    businessHours: iyabo.businessHours,
    breakPeriod: iyabo.breakPeriod
  }, null, 2));
  await mongoose.disconnect();
}
run().catch(console.error);
