const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/erranders');
  const db = mongoose.connection;
  const Order = db.collection('orders');
  const order = await Order.findOne({ _id: new mongoose.Types.ObjectId("6aada1d8442ea7f13d9a2c1d") });
  console.log("paymentStatus:", order.paymentStatus);
  console.log("vendor:", order.vendor);
  process.exit(0);
}
run();
