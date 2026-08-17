const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb://localhost:27017/erranders');
  const db = mongoose.connection.db;
  
  const vendors = await db.collection('vendors').find({ storeName: /Waris/i }).toArray();
  console.log("Vendors:", vendors.map(v => ({ id: v._id, name: v.storeName })));
  
  if (vendors.length > 0) {
    const warisId = vendors[0]._id;
    const packs = await db.collection('menupacks').find({ vendorId: warisId }).toArray();
    console.log("Waris packs:", packs.map(p => ({ name: p.name, isPrepaid: p.isPrepaidByPlatform })));
    
    const items = await db.collection('menuitems').find({ vendorId: warisId }).toArray();
    console.log("Waris items:", items.map(p => ({ name: p.name, isPrepaid: p.isPrepaidByPlatform })));
    
    // Also delete the fake promos from Chijioke Spag and HVIP FOODS etc if they exist
    const fakeVendors = await db.collection('vendors').find({ storeName: { $in: [ /Chijioke/i, /HVIP/i, /Chips by Motee/i, /Iyabo/i ] } }).toArray();
    console.log("Fake vendors:", fakeVendors.map(v => v.storeName));
    
    const fakeVendorIds = fakeVendors.map(v => v._id);
    if (fakeVendorIds.length > 0) {
      await db.collection('menupacks').updateMany({ vendorId: { $in: fakeVendorIds } }, { $set: { isPrepaidByPlatform: false } });
      console.log("Removed isPrepaidByPlatform from fake vendors.");
    }
  }

  process.exit(0);
}

run().catch(console.error);
