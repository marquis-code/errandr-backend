const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr');
  const txModel = mongoose.connection.collection('transactions');
  const orderModel = mongoose.connection.collection('orders');

  const vendorModel = mongoose.connection.collection('vendors');
  const vendor = await vendorModel.findOne({ storeName: { $regex: /smoothie/i } });
  
  const orders = await orderModel.find({ vendor: vendor._id }).sort({ createdAt: -1 }).limit(10).toArray();
  
  const badOrder = orders[0]; // The Sep 27 one
  console.log('Bad Order:', badOrder);

  const tx = await txModel.findOne({ order: badOrder._id });
  console.log('Bad Order Tx:', tx);

  process.exit(0);
}

run().catch(console.error);
