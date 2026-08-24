const mongoose = require('mongoose');
async function run() {
  await mongoose.connect('mongodb://localhost:27017/erranders');
  const user = await mongoose.connection.collection('users').findOne({ email: 'blessingidowu1991@gmail.com' });
  const vendors = await mongoose.connection.collection('vendors').find({ owner: user._id }).toArray();
  const vendorIds = vendors.map(v => v._id);
  const filter = { vendor: { $in: vendorIds }, status: { $nin: ['pending', 'negotiating', 'awaiting_payment'] } };
  const orders = await mongoose.connection.collection('orders').find(filter).toArray();
  console.log("Found orders count:", orders.length);
  console.log("Statuses found:", [...new Set(orders.map(o => o.status))]);
  await mongoose.disconnect();
}
run();
