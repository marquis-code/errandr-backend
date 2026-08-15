const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const users = mongoose.connection.collection('users');
  const vendors = mongoose.connection.collection('vendors');
  const menupacks = mongoose.connection.collection('menupacks');

  const vendorByStoreName = await vendors.findOne({ storeName: /HVIP/i });
  const user = await users.findOne({ email: 'hvipfoods@vendor.com' });
  const vendorByEmail = user ? await vendors.findOne({ owner: user._id }) : null;
  
  const vendor = vendorByStoreName || vendorByEmail;
  
  if (vendor) {
    console.log('Vendor found:', vendor.storeName);
    console.log('Vendor Type:', vendor.vendorType);
    
    // Change to restaurant
    await vendors.updateOne({ _id: vendor._id }, { $set: { vendorType: 'restaurant' } });
    console.log('Updated Vendor Type to restaurant');
    
    const packs = await menupacks.find({ vendorId: vendor._id }).toArray();
    console.log('Packs:', packs.map(p => p.name));
  } else {
    console.log('HVIP not found');
  }

  process.exit(0);
}
run().catch(console.error);
