require('dotenv').config();
const mongoose = require('mongoose');

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 2);

  // Check for withdrawals collection
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map(c => c.name);
  console.log('Collections containing "withdraw" or "payout":', collectionNames.filter(c => c.includes('withdraw') || c.includes('payout')));
  
  if (collectionNames.includes('withdrawals')) {
      const withdrawals = await db.collection('withdrawals').find({ createdAt: { $gte: yesterday } }).sort({createdAt: -1}).toArray();
      console.log(`Found ${withdrawals.length} withdrawals from last night/recently.`);
      for (const w of withdrawals) {
          const wallet = await db.collection('wallets').findOne({ _id: w.wallet });
          const ownerId = wallet ? wallet.owner : w.user || w.vendor;
          const user = await db.collection('users').findOne({ _id: ownerId });
          console.log(`Withdrawal ID: ${w._id}, Amount: ${w.amount}, Status: ${w.status}, Date: ${w.createdAt}`);
          console.log(`  -> User: ${user ? user.firstName + ' ' + user.lastName + ' (' + user.email + ')' : ownerId}`);
          
          // Check transaction
          const tx = await db.collection('transactions').findOne({
              wallet: wallet ? wallet._id : null,
              amount: w.amount,
              type: 'debit',
              createdAt: { $gte: yesterday }
          });
          console.log(`  -> Wallet debited: ${tx ? 'Yes' : 'No'}`);
          console.log(`  -> Wallet current balance: ${wallet ? wallet.balance : 'N/A'}`);
          console.log('');
      }
  }

  // Check transactions for debits
  const txs = await db.collection('transactions').find({
      type: 'debit',
      createdAt: { $gte: yesterday }
  }).sort({createdAt: -1}).toArray();

  console.log(`\nFound ${txs.length} debit transactions since yesterday.`);
  for (const t of txs) {
      if (t.description && t.description.toLowerCase().includes('order')) continue; // Skip order payments if any?
      
      const wallet = await db.collection('wallets').findOne({ _id: t.wallet });
      const ownerId = wallet ? wallet.owner : null;
      const user = ownerId ? await db.collection('users').findOne({ _id: ownerId }) : null;
      console.log(`Tx ID: ${t._id}, Amount: ${t.amount}, Desc: ${t.description}, Date: ${t.createdAt}`);
      console.log(`  -> User: ${user ? user.firstName + ' ' + user.lastName + ' (' + user.email + ')' : ownerId}`);
      console.log(`  -> Wallet current balance: ${wallet ? wallet.balance : 'N/A'}`);
      console.log('');
  }

  process.exit(0);
}

check().catch(console.error);
