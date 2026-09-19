const mongoose = require('mongoose');
async function main() {
  const uri = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/test?appName=errandr";
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const transactions = db.collection('transactions');
  const txs = await transactions.find({}).sort({ createdAt: -1 }).limit(5).toArray();
  console.log(txs);
  await mongoose.disconnect();
}
main().catch(console.error);
