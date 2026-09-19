const mongoose = require('mongoose');
const uri = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr";

async function main() {
  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.useDb('test').db;
    
    const order = await db.collection('orders').findOne({ orderNumber: "EXT-2D483D4A" });
    console.log("Order Type:", order.type);
    console.log("Errander:", order.errander);
    console.log("Customer:", order.customer);
    
    console.log("\n----- Transactions for this Order -----");
    const txns = await db.collection('transactions').find({
        reference: order._id.toString()
    }).toArray();
    txns.forEach(tx => {
        console.log(`[${tx.type}] Wallet: ${tx.walletId} Amount: ${tx.amount} - Ref: ${tx.reference} - Desc: ${tx.description}`);
    });
    
  } catch (error) {
    console.error(error);
  } finally {
    await mongoose.disconnect();
  }
}

main();
