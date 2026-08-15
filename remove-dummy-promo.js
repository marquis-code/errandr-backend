const mongoose = require('mongoose');

const MONGODB_URI = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr";

async function removeDummyPromo() {
  try {
    await mongoose.connect(MONGODB_URI);
    const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }), 'products');
    await Product.updateMany({ isPrepaidByPlatform: true }, { $set: { isPrepaidByPlatform: false } });
    console.log('Removed dummy promo flags.');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

removeDummyPromo();
