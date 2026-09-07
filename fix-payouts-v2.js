const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?retryWrites=true&w=majority').then(async () => {
  const db = mongoose.connection.db;
  
  console.log("Starting retrospective payout check (v2)...");
  
  const deliveredOrders = await db.collection('orders').find({ 
    status: 'delivered', 
    errander: { $exists: true, $ne: null } 
  }).toArray();
  
  console.log(`Found ${deliveredOrders.length} delivered orders with an errander.`);
  
  let missingCount = 0;
  
  for (const order of deliveredOrders) {
    const wallet = await db.collection('wallets').findOne({ owner: order.errander });
    if (!wallet) continue;
    
    // Check if there is a credit transaction for this order IN THE ERRANDER'S WALLET
    const tx = await db.collection('transactions').findOne({
      wallet: wallet._id,
      order: order._id.toString(),
      type: 'credit'
    });
    
    const txObjId = await db.collection('transactions').findOne({
      wallet: wallet._id,
      order: order._id,
      type: 'credit'
    });
    
    const txDesc = await db.collection('transactions').findOne({
      wallet: wallet._id,
      description: { $regex: order.orderNumber },
      type: 'credit'
    });

    if (!tx && !txObjId && !txDesc) {
      console.log(`Missing payout for order ${order.orderNumber} (ID: ${order._id}). Errander: ${order.errander}`);
      missingCount++;
      
      const erranderEarnings = (order.erranderPayout || order.deliveryFee) + (order.tips || 0);
      
      console.log(`  -> Crediting ${erranderEarnings} to errander ${order.errander}`);
      
      await db.collection('wallets').updateOne(
        { _id: wallet._id },
        { $inc: { balance: erranderEarnings, totalEarned: erranderEarnings } }
      );
      
      await db.collection('users').updateOne(
        { _id: order.errander },
        { $inc: { walletBalance: erranderEarnings } }
      );
      
      await db.collection('transactions').insertOne({
        wallet: wallet._id,
        amount: erranderEarnings,
        type: 'credit',
        description: `Delivery earnings for order ${order.orderNumber} (Retroactive fix v2)`,
        order: order._id.toString(),
        status: 'completed',
        actionType: 'automatic',
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }
  
  console.log(`Fixed ${missingCount} missing payouts.`);
  process.exit();
}).catch(err => {
  console.error(err);
  process.exit(1);
});
