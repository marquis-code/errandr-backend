const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr');
  console.log('Connected to DB');

  const vendorModel = mongoose.connection.collection('vendors');
  const orderModel = mongoose.connection.collection('orders');
  const walletModel = mongoose.connection.collection('wallets');
  const txModel = mongoose.connection.collection('transactions');

  const vendor = await vendorModel.findOne({ storeName: { $regex: /smoothie/i } });
  if (!vendor) {
    const v2 = await vendorModel.findOne({ storeName: { $regex: /smoth/i } });
    if (!v2) {
      console.log('Vendor not found');
      process.exit(0);
    } else {
      console.log('Vendor found:', v2.storeName);
      Object.assign(vendor, v2);
    }
  } else {
    console.log('Vendor:', vendor.storeName, 'Owner ID:', vendor.owner);
  }

  const vendorToUse = vendor || await vendorModel.findOne({ storeName: { $regex: /smothie/i } });
  
  if (!vendorToUse) process.exit(0);

  const wallet = await walletModel.findOne({ owner: vendorToUse.owner });
  console.log('Wallet balance:', wallet.balance, 'totalEarned:', wallet.totalEarned);

  const orders = await orderModel.find({ vendor: vendorToUse._id }).toArray();
  console.log(`Found ${orders.length} orders for vendor`);
  
  for (const order of orders) {
    if (order.total === 3200 || order.vendorTotal === 3200) {
      console.log('Order for 3200:', order._id, 'Status:', order.status, 'vendorTotal:', order.vendorTotal, 'total:', order.total);
      const tx = await txModel.findOne({ order: order._id.toString() });
      if (tx) console.log('Found string tx', tx);
      const tx2 = await txModel.findOne({ order: order._id });
      if (tx2) console.log('Found ObjectId tx', tx2);
    }
  }

  const allTx = await txModel.find({ wallet: wallet._id }).toArray();
  console.log(`Wallet has ${allTx.length} total transactions`);
  
  let sum = 0;
  for(const t of allTx) {
     if(t.type === 'credit' && t.status === 'completed') sum += t.amount;
  }
  console.log('Sum of all completed credits:', sum);

  process.exit(0);
}

run().catch(console.error);
