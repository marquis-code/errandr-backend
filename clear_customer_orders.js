const mongoose = require('mongoose');
require('dotenv').config();

const emailsToClear = [
  'ahmedthompson79@gmail.com',
  'blessingidowu1991@gmail.com'
];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const usersCollection = mongoose.connection.collection('users');
  const ordersCollection = mongoose.connection.collection('orders');

  let totalDeleted = 0;

  for (const email of emailsToClear) {
    const user = await usersCollection.findOne({ email });
    if (!user) {
      console.log(`User not found for email: ${email}`);
      continue;
    }

    // Delete all orders where this user is the customer
    const result = await ordersCollection.deleteMany({ customer: user._id });
    
    console.log(`Cleared ${result.deletedCount} orders for customer: ${email} (${user._id})`);
    totalDeleted += result.deletedCount;
  }

  console.log(`\nOperation complete. Total orders cleared: ${totalDeleted}`);
  await mongoose.disconnect();
}

run().catch(console.error);
