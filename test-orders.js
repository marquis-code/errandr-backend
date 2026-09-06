const mongoose = require('mongoose');
async function run() {
  await mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr');
  const db = mongoose.connection.db;
  const orders = await db.collection('marketpoolorders').find({}).toArray();
  console.log("Total orders:", orders.length);
  if (orders.length > 0) {
    console.log("First order:", orders[orders.length - 1]);
  }
  process.exit(0);
}
run().catch(console.error);
