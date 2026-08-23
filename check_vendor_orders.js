const mongoose = require('mongoose');
require('dotenv').config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/erranders');
  const db = mongoose.connection.db;
  
  // Find vendor Chijioke Spag
  const vendor = await db.collection('vendors').findOne({ _id: new mongoose.Types.ObjectId('6a4e4d975be2071e5278568c') });
  
  if (!vendor) {
    console.log("Vendor not found");
    process.exit(0);
  }

  const vendorId = vendor._id;
  
  const filter = { vendor: vendorId };
  // No status filter implies $nin: ['pending', 'awaiting_payment']
  filter.status = { $nin: ['pending', 'awaiting_payment'] };

  const orders = await db.collection('orders').find(filter).sort({ createdAt: -1 }).limit(50).toArray();
  
  const orderExists = orders.some(o => o.orderNumber.startsWith('ERR-EA538E8E'));
  console.log("Order found in top 50 vendor orders:", orderExists);
  console.log("Total returned:", orders.length);

  process.exit(0);
}
check().catch(console.error);
