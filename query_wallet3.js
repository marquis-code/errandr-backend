const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr');
  const txModel = mongoose.connection.collection('transactions');
  const orderModel = mongoose.connection.collection('orders');
  const vendorModel = mongoose.connection.collection('vendors');

  const vendor = await vendorModel.findOne({ storeName: { $regex: /smoothie/i } });
  
  const orders = await orderModel.find({ vendor: vendor._id }).sort({ createdAt: -1 }).limit(10).toArray();
  console.log('Recent 10 orders:');
  for (const o of orders) {
    console.log(`${o.createdAt} | ${o.orderId} | Status: ${o.status} | Total: ${o.total} | VendorTotal: ${o.vendorTotal}`);
    const tx = await txModel.findOne({ order: o._id });
    if (tx) console.log(`   -> Tx found: ${tx.amount} ${tx.type}`);
    else console.log(`   -> No tx found!`);
  }

  process.exit(0);
}

run().catch(console.error);
