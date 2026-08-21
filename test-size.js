require('dotenv').config({ path: __dirname + '/.env' });
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const stats = await mongoose.connection.db.command({ collStats: 'erranders' });
  console.log(`Size: ${stats.size} bytes`);
  console.log(`AvgObjSize: ${stats.avgObjSize} bytes`);
  process.exit(0);
}
run();
