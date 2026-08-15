const mongoose = require('mongoose');
require('dotenv').config();

const emailsToClear = [
  'ahmedthompson79@gmail.com',
  'blessingidowu1991@gmail.com'
];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  // Use Mongoose models to let it handle types automatically
  require('./src/modules/users/schemas/user.schema');
  require('./src/modules/vendors/schemas/vendor.schema');
  require('./src/modules/orders/schemas/order.schema');

  const User = mongoose.model('User');
  const Vendor = mongoose.model('Vendor');
  const Order = mongoose.model('Order');

  let totalDeleted = 0;

  for (const email of emailsToClear) {
    const user = await User.findOne({ email });
    if (!user) {
      console.log(`User not found for email: ${email}`);
      continue;
    }

    // Check if this user is a vendor
    const vendor = await Vendor.findOne({ user: user._id });
    if (vendor) {
      // Delete orders where they are the vendor
      const vendorRes = await Order.deleteMany({ vendor: vendor._id });
      console.log(`Cleared ${vendorRes.deletedCount} orders where ${email} is the VENDOR.`);
      totalDeleted += vendorRes.deletedCount;
    }

    // Also delete orders where they are the customer
    const customerRes = await Order.deleteMany({ customer: user._id });
    console.log(`Cleared ${customerRes.deletedCount} orders where ${email} is the CUSTOMER.`);
    totalDeleted += customerRes.deletedCount;
  }

  console.log(`\nOperation complete. Total orders cleared: ${totalDeleted}`);
  await mongoose.disconnect();
}

run().catch(console.error);
