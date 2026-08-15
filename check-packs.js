const mongoose = require('mongoose');

const MONGODB_URI = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr";

async function checkPacks() {
  try {
    await mongoose.connect(MONGODB_URI);
    
    // Check old packs schema
    const Pack = mongoose.model('Pack', new mongoose.Schema({}, { strict: false }), 'packs');
    const oldPacks = await Pack.find({});
    console.log(`Found ${oldPacks.length} packs in 'packs' collection.`);
    if (oldPacks.length > 0) {
      console.log('Sample old pack:', oldPacks[0]);
    }

    // Check new menu_packs schema
    const MenuPack = mongoose.model('MenuPack', new mongoose.Schema({}, { strict: false }), 'menu_packs');
    const newPacks = await MenuPack.find({});
    console.log(`Found ${newPacks.length} packs in 'menu_packs' collection.`);
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

checkPacks();
