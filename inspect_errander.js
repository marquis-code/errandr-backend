const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const erranders = await mongoose.connection.collection('erranders').find({}).limit(1).toArray();
  console.log(JSON.stringify(erranders[0], null, 2));
  await mongoose.disconnect();
}
run().catch(console.error);
