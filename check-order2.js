const mongoose = require('mongoose');
const uri = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr";

async function main() {
  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.useDb('test').db;
    const order = await db.collection('orders').findOne({ orderNumber: "EXT-2D483D4A" });
    
    console.log("itemCostDisbursementStatus:", order.itemCostDisbursementStatus);
    console.log("actualItemCost:", order.actualItemCost);
    console.log("customDetails:", JSON.stringify(order.customDetails, null, 2));
    console.log("paymentStatus:", order.paymentStatus);
    console.log("status:", order.status);
    console.log("vendorShare:", order.vendorShare);
    
  } catch (error) {
    console.error(error);
  } finally {
    await mongoose.disconnect();
  }
}
main();
