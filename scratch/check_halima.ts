import * as mongoose from 'mongoose';
import * as fs from 'fs';

async function check() {
  const uri = fs.readFileSync('scratch/uri.txt', 'utf8').trim().replace(/^"|"$/g, '');
  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db!;
    
    // Find User
    const user = await db.collection('users').findOne({ firstName: /halima/i, lastName: /onitiju/i });
    if (!user) {
      console.log('User Halima Onitiju not found!');
      return;
    }
    console.log(`User found: ${user.firstName} ${user.lastName} (ID: ${user._id})`);
    
    // Find Errander profile
    const errander = await db.collection('erranders').findOne({ user: user._id });
    console.log(`Errander profile: totalDeliveries=${errander?.totalDeliveries}, totalEarnings=${errander?.totalEarnings}`);
    
    // Find completed orders
    const orders = await db.collection('orders').find({ errander: user._id, status: 'completed' }).toArray();
    console.log(`Found ${orders.length} completed orders for this errander.`);
    let calculatedEarnings = 0;
    for (const o of orders) {
      console.log(`Order ${o._id}: deliveryFee=${o.deliveryFee}`);
      calculatedEarnings += o.deliveryFee || 0;
    }
    console.log(`Sum of delivery fees from completed orders: ${calculatedEarnings}`);
    
    // Find Wallet
    const wallet = await db.collection('wallets').findOne({ user: user._id });
    console.log(`Wallet balance: ${wallet?.balance}, Ledger Balance: ${wallet?.ledgerBalance}`);
    
    // Fix wallet
    if (wallet && wallet.balance !== calculatedEarnings) {
        console.log(`Fixing wallet balance from ${wallet.balance} to ${calculatedEarnings}...`);
        await db.collection('wallets').updateOne({ _id: wallet._id }, { $set: { balance: calculatedEarnings } });
        console.log('Wallet fixed.');
    }
    
    if (errander && errander.totalEarnings !== calculatedEarnings) {
        console.log(`Fixing errander profile totalEarnings from ${errander.totalEarnings} to ${calculatedEarnings}...`);
        await db.collection('erranders').updateOne({ _id: errander._id }, { $set: { totalEarnings: calculatedEarnings } });
        console.log('Errander profile fixed.');
    }
    
  } finally {
    await mongoose.disconnect();
  }
}

check().catch(console.error);
