const mongoose = require('mongoose');

const MONGODB_URI = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr";

async function clearCustomErrands() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB.");

  const db = mongoose.connection.db;

  try {
    const result = await db.collection('orders').deleteMany({
      type: 'custom_errand',
      status: { $in: ['pending', 'negotiating', 'confirmed'] },
      errander: { $exists: false }
    });

    console.log(`Successfully deleted ${result.deletedCount} unassigned custom errands.`);
    
    // Also try checking errander: null just in case
    const result2 = await db.collection('orders').deleteMany({
      type: 'custom_errand',
      status: { $in: ['pending', 'negotiating', 'confirmed'] },
      errander: null
    });
    console.log(`Successfully deleted ${result2.deletedCount} unassigned custom errands (errander = null).`);

  } catch (error) {
    console.error("Error clearing custom errands:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

clearCustomErrands();
