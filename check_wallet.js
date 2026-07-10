require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected.");
  const db = mongoose.connection.db;
  const wallets = await db.collection('wallets').find({}).toArray();
  console.log(JSON.stringify(wallets, null, 2));
  process.exit(0);
}
run().catch(console.error);
