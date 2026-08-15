const mongoose = require('mongoose');

const MONGODB_URI = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr";

async function checkMorePacks() {
  try {
    await mongoose.connect(MONGODB_URI);
    
    // Check new menupacks schema
    const MenuPack = mongoose.model('MenuPack', new mongoose.Schema({}, { strict: false }), 'menupacks');
    const newPacks = await MenuPack.find({});
    console.log(`Found ${newPacks.length} packs in 'menupacks' collection.`);
    if (newPacks.length > 0) {
      console.log('Sample new pack:', newPacks[0]);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

checkMorePacks();
