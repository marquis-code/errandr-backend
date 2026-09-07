const mongoose = require('mongoose');
async function run() {
  await mongoose.connect("mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr");
  const Order = mongoose.connection.db.collection('orders');
  const res = await Order.deleteOne({ orderNumber: 'ERR-AF668231' });
  console.log('Deleted order:', res.deletedCount);
  process.exit(0);
}
run();
