const mongoose = require('mongoose');
const uri = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/test?appName=errandr";

async function run() {
  try {
    const conn = await mongoose.connect(uri);
    const db = mongoose.connection.useDb('test').db;
    
    const ordersCol = db.collection('orders');
    
    const allOrders = await ordersCol.find({}).toArray();
    console.log(`Found ${allOrders.length} orders total.`);
    
    const match1 = allOrders.find(o => String(o.orderNumber).includes('0D419944'));
    if (match1) console.log("Found match for 1: ", match1.orderNumber);
    
    const match2 = allOrders.find(o => String(o.orderNumber).includes('D4E45BFC'));
    if (match2) console.log("Found match for 2: ", match2.orderNumber);
    
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
