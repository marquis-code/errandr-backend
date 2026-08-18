const mongoose = require('mongoose');
const uri = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/test?appName=errandr";

async function run() {
  try {
    const conn = await mongoose.connect(uri);
    const db = mongoose.connection.useDb('test').db;
    
    const ordersCol = db.collection('orders');
    
    const orderNumbers = ['ERR-0D419944', 'ERR-D4E45BFC'];
    
    for (const number of orderNumbers) {
      const result = await ordersCol.deleteOne({ orderNumber: number });
      console.log(`Deleted ${result.deletedCount} orders for ${number}`);
    }
    
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
