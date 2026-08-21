const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/erranders');

async function run() {
  const Vendor = mongoose.connection.collection('vendors');
  const vendor = await Vendor.findOne({ storeName: /Motee/i });
  console.log(vendor);
  
  const User = mongoose.connection.collection('users');
  const owner = await User.findOne({ _id: vendor.owner });
  console.log('Owner:', owner);
  process.exit(0);
}
run().catch(console.error);
