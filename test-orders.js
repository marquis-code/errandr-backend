const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const orders = await db.collection('orders').find({ "customDetails.attachedVoiceNote": { $exists: true, $ne: null } }).sort({createdAt: -1}).limit(3).toArray();
  orders.forEach(o => console.log(o.customDetails.attachedVoiceNote));
  process.exit(0);
}
run();
