require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  
  const user = await db.collection('users').findOne({ 
    $or: [ 
      { firstName: /Mitchelle/i, lastName: /Udechukwu/i },
      { firstName: /Udechukwu/i, lastName: /Mitchelle/i },
      { email: /Mitchelle/i }
    ]
  });
  
  if (!user) {
    console.log('User not found');
    process.exit(0);
  }
  
  console.log('User:', user.email, user.firstName, user.lastName, user._id);
  
  const wallet = await db.collection('wallets').findOne({ owner: user._id });
  console.log('Wallet balance:', wallet ? wallet.balance : 'No wallet');
  
  const txs = await db.collection('transactions').find({ wallet: wallet?._id }).sort({ createdAt: -1 }).limit(5).toArray();
  console.log('Recent Txs:', JSON.stringify(txs, null, 2));
  
  // also check generic webhooks?
  process.exit(0);
}

run();
