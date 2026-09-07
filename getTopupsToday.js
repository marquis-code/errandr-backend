require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0); // Start of today (UTC)
  
  const txs = await db.collection('transactions').find({
    type: 'credit',
    description: { $regex: /top-up|funded/i },
    createdAt: { $gte: today }
  }).sort({ createdAt: -1 }).toArray();
  
  if (txs.length === 0) {
    console.log('No other top-ups found today.');
  } else {
    for (const tx of txs) {
      const wallet = await db.collection('wallets').findOne({ _id: tx.wallet });
      if (wallet && wallet.owner) {
        const user = await db.collection('users').findOne({ _id: wallet.owner });
        console.log(`- ${user ? user.firstName + ' ' + user.lastName + ' (' + user.email + ')' : 'Unknown User'} topped up ₦${tx.amount} at ${tx.createdAt.toISOString()}`);
      } else {
        console.log(`- Unknown Wallet (${tx.wallet}) topped up ₦${tx.amount} at ${tx.createdAt.toISOString()}`);
      }
    }
  }
  
  process.exit(0);
}

run();
