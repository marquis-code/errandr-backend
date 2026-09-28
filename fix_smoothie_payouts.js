const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr');
  const Order = mongoose.connection.collection('orders');
  const Vendor = mongoose.connection.collection('vendors');
  const Transaction = mongoose.connection.collection('transactions');
  const Wallet = mongoose.connection.collection('wallets');
  
  const vendor = await Vendor.findOne({ storeName: { $regex: /smoothie/i } });
  if (!vendor) return console.log('Vendor not found');
  
  const wallet = await Wallet.findOne({ owner: vendor.owner });
  
  const orders = await Order.find({ vendor: vendor._id, status: 'delivered' }).toArray();
  console.log(`Checking ${orders.length} delivered orders for Smoothie Daddi...`);
  
  let fixedCount = 0;
  for (const order of orders) {
    const tx = await Transaction.findOne({ wallet: wallet._id, order: order._id.toString(), type: 'credit' }) 
            || await Transaction.findOne({ wallet: wallet._id, order: order._id, type: 'credit' });
            
    if (!tx && order.vendorShare) {
      console.log(`Order ${order.orderNumber} is missing vendor payout of ${order.vendorShare}`);
      
      await Wallet.updateOne({ _id: wallet._id }, { $inc: { balance: order.vendorShare, totalEarned: order.vendorShare } });
      const User = mongoose.connection.collection('users');
      await User.updateOne({ _id: vendor.owner }, { $inc: { walletBalance: order.vendorShare } });
      
      await Transaction.insertOne({
        wallet: wallet._id,
        amount: order.vendorShare,
        type: 'credit',
        description: `Earnings from order ${order.orderNumber} (Manual Fix)`,
        order: order._id.toString(),
        status: 'completed',
        actionType: 'automatic',
        createdAt: new Date(),
        updatedAt: new Date(),
        __v: 0
      });
      fixedCount++;
      console.log(`Fixed order ${order.orderNumber}.`);
    }
  }
  
  console.log(`Fixed ${fixedCount} orders.`);
  
  process.exit(0);
}

run().catch(console.error);
