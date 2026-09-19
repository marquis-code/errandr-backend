const mongoose = require('mongoose');
const uri = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr";

async function main() {
  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.useDb('test').db;
    
    // Fix the specific order
    const result = await db.collection('orders').updateOne(
      { orderNumber: "EXT-2D483D4A" },
      { $set: { itemCostDisbursementStatus: 'pending' } }
    );
    console.log("Updated:", result.modifiedCount, "document(s)");
    
    // Also fix ALL custom_errand orders that were falsely set to 'transferred' 
    // but have no vendorPaymentDetails (meaning the errander never actually paid)
    const bulkResult = await db.collection('orders').updateMany(
      { 
        type: 'custom_errand', 
        itemCostDisbursementStatus: 'transferred',
        vendorPaymentDetails: { $exists: false }
      },
      { $set: { itemCostDisbursementStatus: 'pending' } }
    );
    console.log("Bulk fixed:", bulkResult.modifiedCount, "order(s) that were falsely marked as transferred");
    
    // Verify
    const order = await db.collection('orders').findOne({ orderNumber: "EXT-2D483D4A" });
    console.log("\nVerification - EXT-2D483D4A:");
    console.log("  itemCostDisbursementStatus:", order.itemCostDisbursementStatus);
    
  } catch (error) {
    console.error(error);
  } finally {
    await mongoose.disconnect();
  }
}
main();
