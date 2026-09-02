const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/erranders');
  const db = mongoose.connection;
  const order = await db.collection('orders').findOne({ orderNumber: 'ERR-E9D29F62' });
  console.log('--- PACKS ---');
  console.log(JSON.stringify(order?.packs, null, 2));
  console.log('--- ITEMS ---');
  console.log(JSON.stringify(order?.items, null, 2));
  process.exit(0);
}
run().catch(console.error);
