require('dotenv').config();
const mongoose = require('mongoose');

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map(c => c.name);
  
  let payoutsCollectionName = collectionNames.find(c => c.includes('payout'));
  if (payoutsCollectionName) {
      console.log('Found payouts collection:', payoutsCollectionName);
      const Payouts = db.collection(payoutsCollectionName);
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 2);
      
      const payouts = await Payouts.find({ createdAt: { $gte: yesterday } }).sort({createdAt: -1}).toArray();
      console.log('Recent payouts:', payouts.length);
      
      for (const p of payouts) {
          const user = await db.collection('users').findOne({ _id: p.user || p.userId || p.vendor || p.vendorId });
          console.log(`Payout ID: ${p._id}, Amount: ${p.amount}, User: ${user ? user.email + ' / ' + user.firstName : 'Unknown'} (${p.user})`);
          
          // Check transactions
          const txs = await db.collection('transactions').find({ 
              user: user ? user._id : null,
              createdAt: { $gte: yesterday }
          }).toArray();
          const debitTx = txs.find(tx => tx.type === 'DEBIT' || (tx.amount < 0) || tx.description.match(/payout/i));
          console.log(`  - Wallet debit tx found: ${debitTx ? 'Yes (Amt: '+debitTx.amount+')' : 'No'}`);
          
          // Check wallet balance
          const wallet = await db.collection('wallets').findOne({ user: user ? user._id : null });
          console.log(`  - Current Wallet Balance: ${wallet ? wallet.balance : 'N/A'}`);
      }
  } else {
      console.log('No payouts collection found. Let us check transactions for payouts.');
      const txs = await db.collection('transactions').find({
          $or: [
              { type: 'PAYOUT' },
              { description: /payout/i }
          ]
      }).sort({createdAt: -1}).limit(10).toArray();
      
      for (const t of txs) {
          const user = await db.collection('users').findOne({ _id: t.user });
          console.log(`Tx ID: ${t._id}, Date: ${t.createdAt}, Amount: ${t.amount}, User: ${user ? user.email : 'Unknown'}`);
          const wallet = await db.collection('wallets').findOne({ user: t.user });
          console.log(`  - Current Wallet Balance: ${wallet ? wallet.balance : 'N/A'}`);
      }
  }

  process.exit(0);
}

check().catch(console.error);
