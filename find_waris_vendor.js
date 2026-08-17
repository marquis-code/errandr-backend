const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/erranders');
  const vendors = mongoose.connection.collection('vendors');

  const warisVendors = await vendors.find({ name: { $regex: /waris/i } }).toArray();
  
  if (warisVendors.length > 0) {
    console.log(warisVendors.map(v => ({ id: v._id, name: v.name, isOpen: v.isOpen, isOnline: v.isOnline })));
  } else {
    console.log("No vendor found with name containing 'waris'");
  }
  
  process.exit(0);
}

run().catch(console.error);
