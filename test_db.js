const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const db = mongoose.connection.db;
    const vendor = await db.collection('vendors').findOne({ storeName: /Iyabo/i });
    if (!vendor) {
      console.log('Vendor not found');
      process.exit(0);
    }
    console.log('Vendor ID:', vendor._id);
    
    const items = await db.collection('menuitems').find({ vendorId: vendor._id }).toArray();
    console.log('Items for vendor:', items.length);
    items.forEach(i => {
      console.log(`- ${i.name}: pricePerPortion=${i.pricePerPortion}, price=${i.price}`);
    });
    
    // Also check what markup factor is applied
    const settings = await db.collection('settings').findOne({});
    console.log('Settings:', settings);
    
    process.exit(0);
  });
