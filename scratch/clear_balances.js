const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const wallets = mongoose.connection.collection('wallets');
  const transactions = mongoose.connection.collection('transactions');
  const users = mongoose.connection.collection('users');

  // Clear balances for all vendors (role='vendor') and admin (role='admin')
  const vendorsAndAdmin = await users.find({ role: { $in: ['vendor', 'admin'] } }).toArray();
  const targetUserIds = vendorsAndAdmin.map(u => u._id);
  
  console.log(`Found ${targetUserIds.length} users (vendors + admins).`);

  const walletUpdateRes = await wallets.updateMany(
    { user: { $in: targetUserIds } },
    { $set: { balance: 0, ledgerBalance: 0, pendingBalance: 0 } }
  );
  
  console.log(`Updated ${walletUpdateRes.modifiedCount} wallets to 0 balance.`);

  // Find transaction to preserve
  const orderNumber = 'EXT-7648443E';
  const txsToPreserve = await transactions.find({ 
    $or: [ 
      { reference: { $regex: orderNumber } }, 
      { description: { $regex: orderNumber } } 
    ] 
  }).toArray();
  
  const preserveIds = txsToPreserve.map(tx => tx._id);
  console.log(`Preserving ${preserveIds.length} transactions for order ${orderNumber}.`);

  const deleteTxRes = await transactions.deleteMany({ _id: { $nin: preserveIds } });
  
  console.log(`Deleted ${deleteTxRes.deletedCount} transactions.`);

  process.exit(0);
}

run().catch(console.error);
