const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  // Find user
  const user = await mongoose.connection.collection('users').findOne({ email: 'abbie.aigbehi@gmail.com' });
  if (!user) {
    console.log('User not found');
    return process.exit();
  }
  console.log('User found:', user._id);

  // Find errander profile
  const errander = await mongoose.connection.collection('erranders').findOne({ user: user._id });
  if (!errander) {
    console.log('Errander profile not found');
    return process.exit();
  }
  console.log('Errander profile found:', errander._id);

  // Find the order that has this errander or user assigned, and is not delivered yet
  let order = await mongoose.connection.collection('orders').findOne({
    $or: [
      { errander: errander._id },
      { errander: user._id }
    ],
    status: { $nin: ['delivered', 'cancelled'] }
  });

  if (!order) {
    console.log('No active order found for this errander.');
    // Let's try to find any order with deliveryPin: '7246' just in case
    order = await mongoose.connection.collection('orders').findOne({ deliveryPin: '7246' });
    if (!order) {
        console.log('No order found with PIN 7246 either.');
        return process.exit();
    }
  }

  console.log('Found order:', order._id);
  console.log('order.errander is:', order.errander);
  console.log('order.status is:', order.status);
  
  if (order.errander.toString() === user._id.toString()) {
      console.log('The order has the USER ID assigned instead of the ERRANDER PROFILE ID!');
  } else if (order.errander.toString() === errander._id.toString()) {
      console.log('The order has the ERRANDER PROFILE ID assigned correctly.');
  }

  await mongoose.disconnect();
}

run().catch(console.error);
