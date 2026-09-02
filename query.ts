import mongoose from 'mongoose';

async function run() {
  await mongoose.connect('mongodb://localhost:27017/erranders');
  const db = mongoose.connection;
  const order = await db.collection('orders').findOne({ orderNumber: 'ERR-E9D29F62' });
  console.log('PACKS:', JSON.stringify(order?.packs, null, 2));
  console.log('ITEMS:', JSON.stringify(order?.items, null, 2));
  process.exit(0);
}
run();
