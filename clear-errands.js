const mongoose = require('mongoose');

const MONGODB_URI = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr";

async function clearAllAvailableErrands() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Delete all orders that do not have an errander assigned (i.e. available in the pool)
    const result = await mongoose.connection.collection('orders').deleteMany({
      $or: [
        { errander: { $exists: false } },
        { errander: null },
        { status: 'pending' }
      ]
    });

    console.log(`Successfully cleared ${result.deletedCount} available errands (orders without riders) from the database.`);
    
    // Also clear all errandpools
    const poolsResult = await mongoose.connection.collection('errandpools').deleteMany({});
    console.log(`Successfully cleared ${poolsResult.deletedCount} errand pool documents.`);

  } catch (error) {
    console.error('Error clearing errands:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

clearAllAvailableErrands();
