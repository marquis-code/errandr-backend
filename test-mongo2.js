require('dotenv').config({ path: __dirname + '/.env' });
const mongoose = require('mongoose');

async function run() {
  console.log("Connecting...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected. Counting users...");
  const users = await mongoose.connection.db.collection('users').countDocuments();
  console.log(`Users count: ${users}`);
  
  console.log("Counting erranders...");
  const erranders = await mongoose.connection.db.collection('erranders').countDocuments();
  console.log(`Erranders count: ${erranders}`);
  
  process.exit(0);
}
run();
