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

  for (const email of emailsToClear) {
    const user = await usersCollection.findOne({ email });
    if (!user) continue;

    console.log(`Checking orders for user ${email} (${user._id})`);

    const asVendor = await ordersCollection.countDocuments({ vendor: user._id });
    const asCustomer = await ordersCollection.countDocuments({ customer: user._id });
    const asErrander = await ordersCollection.countDocuments({ errander: user._id });

    // What if their user._id is stored as string?
    const asVendorStr = await ordersCollection.countDocuments({ vendor: user._id.toString() });
    
    console.log(`- asVendor (ObjectId): ${asVendor}`);
    console.log(`- asCustomer (ObjectId): ${asCustomer}`);
    console.log(`- asErrander (ObjectId): ${asErrander}`);
    console.log(`- asVendor (String): ${asVendorStr}`);

    // Let's also check if they have a vendor profile using their email string in the vendors collection
    const vendorProfileByEmail = await mongoose.connection.collection('vendors').findOne({ email: email });
    if (vendorProfileByEmail) {
      console.log(`Found vendor profile by email string directly! ID: ${vendorProfileByEmail._id}`);
      const orders = await ordersCollection.deleteMany({ vendor: vendorProfileByEmail._id });
      console.log(`Deleted ${orders.deletedCount} orders using vendorProfileByEmail`);
    }

    const vendorProfileByContact = await mongoose.connection.collection('vendors').findOne({ contactEmail: email });
    if (vendorProfileByContact) {
      console.log(`Found vendor profile by contactEmail string! ID: ${vendorProfileByContact._id}`);
      const orders = await ordersCollection.deleteMany({ vendor: vendorProfileByContact._id });
      console.log(`Deleted ${orders.deletedCount} orders using vendorProfileByContact`);
    }

    // Try deleting where vendor = user._id anyway
    if (asVendor > 0) {
      const res = await ordersCollection.deleteMany({ vendor: user._id });
      console.log(`Deleted ${res.deletedCount} orders directly using user._id in vendor field`);
    }
  }

  await mongoose.disconnect();
}
run().catch(console.error);
