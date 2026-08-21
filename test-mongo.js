require('dotenv').config({ path: __dirname + '/.env' });
const mongoose = require('mongoose');

async function run() {
  console.log("Connecting...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected. Testing queries...");
  
  const start1 = Date.now();
  await mongoose.connection.db.collection('erranders').estimatedDocumentCount();
  console.log(`estimatedDocumentCount: ${Date.now() - start1}ms`);

  const start2 = Date.now();
  await mongoose.connection.db.collection('erranders').find().limit(10).toArray();
  console.log(`find: ${Date.now() - start2}ms`);
  
  process.exit(0);
}
run();
