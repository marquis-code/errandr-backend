const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr');
  const Order = mongoose.connection.collection('orders');
  const Vendor = mongoose.connection.collection('vendors');
  const User = mongoose.connection.collection('users');
  const Wallet = mongoose.connection.collection('wallets');
  
  const fullOrder = await Order.findOne({ orderNumber: 'ERR-57F7E57A' });
  
  const vendorDoc = await Vendor.findOne({ _id: fullOrder.vendor });
  
  // fullOrder.vendor = vendorDoc (populate)
  
  let vendorEarnings = fullOrder.vendorShare;
  if (!vendorEarnings) {
      console.log('No vendorShare found, calculating...');
  }
  
  console.log('vendorEarnings:', vendorEarnings);
  
  const vendorUser = await User.findOne({ _id: vendorDoc.owner || vendorDoc.user });
  
  if (vendorUser && vendorUser._id) {
     console.log('vendorUser._id:', vendorUser._id);
  } else {
     console.log('NO VENDOR USER FOUND!');
  }
  
  // Wallet credit check
  const wallet = await Wallet.findOne({ owner: vendorUser._id });
  console.log('Wallet exists?', !!wallet);
  
  // IDEMPOTENCY CHECK in creditWallet:
  // if (orderId) existing = transactionModel.findOne({ wallet: wallet._id, order: orderId, type: 'credit' })
  const Transaction = mongoose.connection.collection('transactions');
  const existingTx = await Transaction.findOne({ wallet: wallet._id, order: fullOrder._id.toString(), type: 'credit' });
  const existingTx2 = await Transaction.findOne({ wallet: wallet._id, order: fullOrder._id, type: 'credit' });
  
  console.log('Existing tx (string):', !!existingTx);
  console.log('Existing tx (objectId):', !!existingTx2);

  process.exit(0);
}

run().catch(console.error);
