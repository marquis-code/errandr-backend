const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/erranders');
  const db = mongoose.connection;
  const Vendor = db.collection('vendors');
  const vendor = await Vendor.findOne({ _id: new mongoose.Types.ObjectId("6a4e4ba65be2071e52785438") });
  console.log("vendor owner:", vendor.owner);
  process.exit(0);
}
run();
