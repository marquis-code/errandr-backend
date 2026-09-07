import * as mongoose from 'mongoose';
import * as fs from 'fs';

async function fix() {
  const uri = fs.readFileSync('scratch/uri.txt', 'utf8').trim().replace(/^"|"$/g, '');
  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db!;
    
    const user = await db.collection('users').findOne({ firstName: /halima/i, lastName: /onitiju/i });
    if (!user) return console.log('User Halima Onitiju not found!');
    
    const orders = await db.collection('orders').find({ 
        errander: user._id, 
        status: { $in: ['completed', 'delivered'] } 
    }).toArray();
    
    console.log(`Found ${orders.length} delivered/completed orders.`);
    
    // Clear all existing transactions for her to do a clean insert
    await db.collection('transactions').deleteMany({ user: user._id });
    console.log('Cleared existing transactions.');
    
    const deliveryFee = 350;
    const platformFee = 50;
    const netEarningsPerOrder = deliveryFee - platformFee;
    const totalEarnings = orders.length * netEarningsPerOrder;
    
    // Fix wallet
    const wallet = await db.collection('wallets').findOne({ owner: user._id }) || await db.collection('wallets').findOne({ user: user._id });
    
    if (wallet) {
        await db.collection('wallets').updateOne(
            { _id: wallet._id }, 
            { $set: { balance: totalEarnings, ledgerBalance: totalEarnings, totalEarned: totalEarnings } }
        );
        console.log(`Wallet fixed to ${totalEarnings}.`);
        
        // Re-create transactions
        for (const o of orders) {
            await db.collection('transactions').insertOne({
                user: user._id,
                wallet: wallet._id,
                amount: netEarningsPerOrder,
                type: 'credit',
                description: 'Delivery earnings',
                order: o._id,
                status: 'successful',
                createdAt: o.createdAt || new Date(),
                updatedAt: new Date()
            });
            console.log(`Inserted tx for order ${o._id}`);
        }
    }
    
    const errander = await db.collection('erranders').findOne({ user: user._id });
    if (errander) {
        await db.collection('erranders').updateOne(
            { _id: errander._id }, 
            { $set: { totalEarnings: totalEarnings, totalDeliveries: orders.length } }
        );
        console.log('Errander profile fixed.');
    }
    
  } finally {
    await mongoose.disconnect();
  }
}

fix().catch(console.error);
