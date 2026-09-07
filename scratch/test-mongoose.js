const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const messages = await db.collection('chatmessages').find({ roomType: 'support' }).sort({ createdAt: -1 }).limit(10).toArray();
  console.log(messages);
  process.exit(0);
}
run();
