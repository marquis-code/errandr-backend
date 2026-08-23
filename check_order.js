const mongoose = require('mongoose');
require('dotenv').config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/erranders');
  const db = mongoose.connection.db;
  const order = await db.collection('orders').findOne({ orderNumber: { $regex: /^ERR-EA538/ } });
  if (!order) {
    console.log("Order not found");
    process.exit(0);
  }
  const vendor = await db.collection('vendors').findOne({ _id: order.vendor });
  console.log("Order found:", order.orderNumber);
  console.log("Vendor ID:", order.vendor);
  console.log("Vendor Name:", vendor ? vendor.storeName : "Unknown");
  process.exit(0);
}
check().catch(console.error);
