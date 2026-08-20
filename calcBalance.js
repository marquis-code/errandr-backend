require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  
  const user = await db.collection('users').findOne({ email: 'deramitchelle@gmail.com' });
  const wallet = await db.collection('wallets').findOne({ owner: user._id });
  const txs = await db.collection('transactions').find({ wallet: wallet._id, status: 'completed' }).sort({ createdAt: 1 }).toArray();
  
  let calculatedBalance = 0;
  for (const tx of txs) {
    if (tx.type === 'credit') {
      calculatedBalance += tx.amount;
    } else if (tx.type === 'debit') {
      calculatedBalance -= tx.amount;
    }
  }
  
  console.log('Actual DB Balance:', wallet.balance);
  console.log('Calculated Balance:', calculatedBalance);
  console.log('Total Txs:', txs.length);
  
  process.exit(0);
}

run();
