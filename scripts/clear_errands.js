const mongoose = require('mongoose');

const MONGODB_URI = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr";

async function clearErranderOrders() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB.");

  const db = mongoose.connection.db;

  try {
    // We update all orders where errander is set and status is not delivered, cancelled or refunded.
    // Reset them to pending, and unset the errander field.
    const result = await db.collection('orders').updateMany(
      { 
        errander: { $exists: true, $ne: null },
        status: { $nin: ['delivered', 'cancelled', 'refunded'] }
      },
      { 
        $set: { status: 'pending' },
        $unset: { errander: "" }
      }
    );

    console.log(`Successfully reset ${result.modifiedCount} orders.`);
  } catch (error) {
    console.error("Error clearing orders:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

clearErranderOrders();
