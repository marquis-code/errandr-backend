require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  
  const user = await db.collection('users').findOne({ email: 'deramitchelle@gmail.com' });
  const wallet = await db.collection('wallets').findOne({ owner: user._id });
  const txs = await db.collection('transactions').find({ wallet: wallet._id }).sort({ createdAt: -1 }).toArray();
  
  console.log('All Txs including pending:');
  console.log(JSON.stringify(txs, null, 2));
  process.exit(0);
}

run();
