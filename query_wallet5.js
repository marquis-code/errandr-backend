const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr');
  const txModel = mongoose.connection.collection('transactions');
  const orderModel = mongoose.connection.collection('orders');

  const vendorModel = mongoose.connection.collection('vendors');
  const vendor = await vendorModel.findOne({ storeName: { $regex: /smoothie/i } });
  
  const badOrder = await orderModel.findOne({ orderNumber: 'ERR-57F7E57A' });
  
  const txs = await txModel.find({ order: badOrder._id }).toArray();
  const txsString = await txModel.find({ order: badOrder._id.toString() }).toArray();
  
  console.log('Txs with ObjectId order:');
  console.log(txs);
  
  console.log('Txs with string order:');
  console.log(txsString);

  process.exit(0);
}

run().catch(console.error);
