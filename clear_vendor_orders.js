const mongoose = require('mongoose');
require('dotenv').config();

const emailsToClear = [
  'ahmedthompson79@gmail.com',
  'blessingidowu1991@gmail.com'
];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const usersCollection = mongoose.connection.collection('users');
  const vendorsCollection = mongoose.connection.collection('vendors');
  const ordersCollection = mongoose.connection.collection('orders');

  let totalDeleted = 0;

  for (const email of emailsToClear) {
    // 1. Find user by email
    const user = await usersCollection.findOne({ email });
    if (!user) {
      console.log(`User not found for email: ${email}`);
      continue;
    }

    // 2. Find vendor by user ID
    const vendor = await vendorsCollection.findOne({ user: user._id });
    if (!vendor) {
      console.log(`Vendor profile not found for user: ${email} (${user._id})`);
      continue;
    }

    // 3. Delete all orders for this vendor
    const result = await ordersCollection.deleteMany({ vendor: vendor._id });
    
    console.log(`Cleared ${result.deletedCount} orders for vendor: ${vendor.storeName} (${email})`);
    totalDeleted += result.deletedCount;
  }

  console.log(`\nOperation complete. Total orders cleared: ${totalDeleted}`);
  await mongoose.disconnect();
}

run().catch(console.error);
