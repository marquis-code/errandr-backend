const { MongoClient } = require('mongodb');
require('dotenv').config();

async function run() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();
  const messages = await db.collection('chatmessages').find({ roomType: 'support' }).sort({ createdAt: -1 }).limit(10).toArray();
  console.log(messages);
  await client.close();
}
run();
