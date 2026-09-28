const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr');
  const txModel = mongoose.connection.collection('transactions');
  const walletModel = mongoose.connection.collection('wallets');
  const orderModel = mongoose.connection.collection('orders');
  const vendorModel = mongoose.connection.collection('vendors');

  const vendor = await vendorModel.findOne({ storeName: { $regex: /smoothie/i } });
  const wallet = await walletModel.findOne({ owner: vendor.owner });

  const allTx = await txModel.find({ wallet: wallet._id }).sort({ createdAt: -1 }).limit(10).toArray();
  console.log('Recent 10 txs:');
  for (const tx of allTx) {
     console.log(`${tx.createdAt} | ${tx.type} | ${tx.amount} | ${tx.status} | ${tx.description}`);
  }

  process.exit(0);
}

run().catch(console.error);
