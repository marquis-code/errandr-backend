const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  // Find user
  const user = await mongoose.connection.collection('users').findOne({ email: 'abbie.aigbehi@gmail.com' });
  const errander = await mongoose.connection.collection('erranders').findOne({ user: user._id });

  let order = await mongoose.connection.collection('orders').findOne({
    $or: [
      { errander: errander._id },
      { errander: user._id }
    ],
    status: { $nin: ['delivered', 'cancelled'] }
  });

  if (!order) {
    console.log('No active order found.');
    process.exit();
  }

  // Update order status to DELIVERED
  await mongoose.connection.collection('orders').updateOne(
    { _id: order._id },
    {
      $set: { 
        status: 'delivered', 
        deliveryPinStatus: 'verified',
        actualDeliveryTime: new Date()
      },
      $push: {
        statusHistory: {
          status: 'delivered',
          timestamp: new Date(),
          note: 'Order completed manually by admin script due to ID mismatch bug'
        }
      }
    }
  );

  // Update Errander profile
  await mongoose.connection.collection('erranders').updateOne(
    { _id: errander._id },
    {
      $set: { status: 'available' },
      $unset: { currentOrder: "" },
      $inc: { totalDeliveries: 1 }
    }
  );

  // Credit the errander's wallet
  const erranderEarnings = order.erranderPayout || order.deliveryFee || 0;
  console.log(`Crediting wallet for errander ${user._id} with ${erranderEarnings}`);
  
  if (erranderEarnings > 0) {
      await mongoose.connection.collection('wallets').updateOne(
        { user: user._id },
        { $inc: { balance: erranderEarnings } }
      );
      
      await mongoose.connection.collection('transactions').insertOne({
        user: user._id,
        amount: erranderEarnings,
        type: 'credit',
        purpose: 'delivery_payout',
        status: 'completed',
        reference: `MN-DEL-${order._id}-${Date.now()}`,
        description: `Payment for order ${order.orderNumber} (Manual Completion)`,
        metadata: { orderId: order._id },
        createdAt: new Date(),
        updatedAt: new Date()
      });
  }

  console.log('Order manually completed and wallet credited successfully!');

  await mongoose.disconnect();
}

run().catch(console.error);
