import * as mongoose from 'mongoose';
import * as fs from 'fs';

async function check() {
  const uri = fs.readFileSync('scratch/uri.txt', 'utf8').trim().replace(/^"|"$/g, '');
  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db!;
    
    // Find User Halima
    const user = await db.collection('users').findOne({ firstName: /halima/i, lastName: /onitiju/i });
    if (!user) {
      console.log('User Halima Onitiju not found!');
      return;
    }
    
    // Find orders that are either completed or delivered
    const orders = await db.collection('orders').find({ 
        errander: user._id, 
        status: { $in: ['completed', 'delivered'] } 
    }).toArray();
    
    console.log(`Found ${orders.length} delivered/completed orders for this errander.`);
    
    let calculatedEarnings = 0;
    for (const o of orders) {
      calculatedEarnings += o.deliveryFee || 0;
    }
    console.log(`Sum of delivery fees from delivered/completed orders: ${calculatedEarnings}`);
    
    // Fix wallet
    const wallet = await db.collection('wallets').findOne({ user: user._id });
    const walletByOwner = await db.collection('wallets').findOne({ owner: user._id });
    
    const actualWallet = wallet || walletByOwner;
    
    let finalWalletId;

    if (!actualWallet) {
        console.log('Wallet not found for user. Creating one...');
        const result = await db.collection('wallets').insertOne({
            user: user._id,
            owner: user._id, // Add owner field
            balance: calculatedEarnings,
            ledgerBalance: calculatedEarnings,
            totalEarned: calculatedEarnings,
            payoutPreference: 'weekly',
            createdAt: new Date(),
            updatedAt: new Date()
        });
        finalWalletId = result.insertedId;
        console.log('Wallet created with balance', calculatedEarnings);
    } else {
        console.log(`Fixing wallet balance from ${actualWallet.balance} to ${calculatedEarnings}...`);
        await db.collection('wallets').updateOne(
            { _id: actualWallet._id }, 
            { $set: { balance: calculatedEarnings, ledgerBalance: calculatedEarnings, totalEarned: calculatedEarnings, owner: user._id, user: user._id } }
        );
        finalWalletId = actualWallet._id;
        console.log('Wallet fixed.');
    }
    
    // Fix errander profile
    const errander = await db.collection('erranders').findOne({ user: user._id });
    if (errander) {
        console.log(`Fixing errander profile from earnings ${errander.totalEarnings} to ${calculatedEarnings}...`);
        await db.collection('erranders').updateOne(
            { _id: errander._id }, 
            { $set: { totalEarnings: calculatedEarnings, totalDeliveries: orders.length } }
        );
        console.log('Errander profile fixed.');
    }
    
    // Also create transactions for these orders if they don't exist
    for (const o of orders) {
        const txExists = await db.collection('transactions').findOne({ order: o._id, type: 'credit' });
        if (!txExists && o.deliveryFee > 0) {
            await db.collection('transactions').insertOne({
                user: user._id,
                wallet: finalWalletId,
                amount: o.deliveryFee,
                type: 'credit',
                description: 'Delivery earnings',
                order: o._id,
                status: 'successful',
                createdAt: o.createdAt || new Date(),
                updatedAt: new Date()
            });
            console.log(`Created transaction for order ${o._id}`);
        }
    }

  } finally {
    await mongoose.disconnect();
  }
}

check().catch(console.error);
