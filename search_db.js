const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const vendors = await mongoose.connection.collection('vendors').find({}).toArray();
  for (const v of vendors) {
    if (JSON.stringify(v).includes('ahmed') || JSON.stringify(v).includes('blessing')) {
      console.log('Found vendor with email string:', v.storeName, v._id, v.user);
    }
  }

  const orders = await mongoose.connection.collection('orders').find({}).toArray();
  for (const o of orders) {
    if (JSON.stringify(o).includes('ahmed') || JSON.stringify(o).includes('blessing')) {
      console.log('Found order with email string:', o._id);
    }
  }

  console.log('Done searching.');
  await mongoose.disconnect();
}
run().catch(console.error);
