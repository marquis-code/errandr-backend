const mongoose = require('mongoose');

const MONGODB_URI = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr";

async function listCollections() {
  try {
    await mongoose.connect(MONGODB_URI);
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(collections.map(c => c.name));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

listCollections();
