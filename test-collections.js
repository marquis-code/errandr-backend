require('dotenv').config({ path: __dirname + '/.env' });
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log(collections.map(c => c.name + " (" + c.type + ")"));
  process.exit(0);
}
run();
