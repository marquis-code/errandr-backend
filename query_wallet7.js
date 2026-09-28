const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr');
  const Order = mongoose.connection.collection('orders');
  const Vendor = mongoose.connection.collection('vendors');
  const User = mongoose.connection.collection('users');

  const fullOrder = await Order.findOne({ orderNumber: 'ERR-57F7E57A' });
  const vendor = await Vendor.findOne({ _id: fullOrder.vendor });
  const vendorUser = await User.findOne({ _id: vendor.owner });

  console.log('Vendor:', vendor ? vendor.storeName : 'null');
  console.log('Vendor Owner in Vendor collection:', vendor.owner);
  console.log('Vendor User in Users collection:', vendorUser ? vendorUser._id : 'null');

  // Let's check the other recent orders to see if they had the same issue or if they worked.
  const allOrders = await Order.find({ vendor: fullOrder.vendor }).sort({createdAt: -1}).limit(5).toArray();
  for (const o of allOrders) {
     console.log(`Order ${o.orderNumber}: vendorShare=${o.vendorShare}`);
  }
  
  process.exit(0);
}

run().catch(console.error);
