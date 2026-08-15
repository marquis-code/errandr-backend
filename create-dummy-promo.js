const mongoose = require('mongoose');

const MONGODB_URI = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr";

async function createDummyPromo() {
  try {
    await mongoose.connect(MONGODB_URI);
    
    const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }), 'products');
    
    // Find any product
    let item = await Product.findOne({});
    
    if (item) {
      console.log(`Found item: ${item.name}`);
      await Product.updateOne({ _id: item._id }, {
        $set: {
          isPrepaidByPlatform: true
        }
      });
      console.log('Successfully set isPrepaidByPlatform to true for this item.');
    } else {
      console.log('No available menu items found.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

createDummyPromo();
