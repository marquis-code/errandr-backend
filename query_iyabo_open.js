const mongoose = require('mongoose');
require('dotenv').config();
const { checkIsOpen } = require('./dist/utils/vendor-helpers.js');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const iyabo = await db.collection('vendors').findOne({ storeName: /iyabo/i });
  console.log(checkIsOpen(iyabo));
  await mongoose.disconnect();
}
run().catch(console.error);
