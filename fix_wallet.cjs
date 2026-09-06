require('dotenv').config();
const mongoose = require('mongoose');

async function fix() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Order = mongoose.connection.collection('orders');
  const Wallet = mongoose.connection.collection('wallets');
  const Transaction = mongoose.connection.collection('transactions');

  const order = await Order.findOne({ orderNumber: /EXT-11FA3728/i });
  if (!order) {
    console.log('Order not found');
    process.exit(1);
  }

  console.log('Order found, errander:', order.errander);

  // Refund 50 naira
  await Wallet.updateOne(
    { user: order.errander },
    { $inc: { balance: 50 } }
  );

  await Transaction.insertOne({
    user: order.errander,
    amount: 50,
    type: 'credit',
    description: 'Refund for over-deducted platform fee on order EXT-11FA3728',
    status: 'successful',
    reference: `REFUND-${Date.now()}`,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  console.log('Refunded 50 to errander wallet');
  process.exit(0);
}

fix();
