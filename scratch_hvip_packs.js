const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const users = mongoose.connection.collection('users');
  const vendors = mongoose.connection.collection('vendors');
  const menupacks = mongoose.connection.collection('menupacks');
  const addongroups = mongoose.connection.collection('addongroups');

  const vendorByStoreName = await vendors.findOne({ storeName: /HVIP/i });
  const user = await users.findOne({ email: 'hvipfoods@vendor.com' });
  const vendor = vendorByStoreName || (user ? await vendors.findOne({ owner: user._id }) : null);

  if (!vendor) {
    console.log('Vendor not found');
    process.exit(1);
  }

  // Find the packs
  const packs = await menupacks.find({ vendorId: vendor._id }).toArray();
  
  // Create an AddOnGroup for Rice Selection
  const addOnGroupId = new mongoose.Types.ObjectId();
  await addongroups.insertOne({
    _id: addOnGroupId,
    name: 'Rice Selection',
    description: 'Choose your rice type',
    isRequired: true,
    minItems: 1,
    maxItems: 1,
    vendorId: vendor._id,
    addons: [
      { _id: new mongoose.Types.ObjectId(), name: 'Jollof Rice (3 Portions)', price: 0 },
      { _id: new mongoose.Types.ObjectId(), name: 'Fried Rice (3 Portions)', price: 0 },
      { _id: new mongoose.Types.ObjectId(), name: 'Mixed Rice (3 Portions)', price: 0 }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  console.log('Created Rice Selection AddOnGroup');

  // Update the packs
  for (const pack of packs) {
    // Remove "Rice" from the name if possible, or just update the name
    let newName = pack.name;
    if (pack.name.includes('Pack A')) {
      newName = 'Combo Pack A (Beef 2pcs + Plantain 2 Portions)';
    } else if (pack.name.includes('Pack B')) {
      newName = 'Combo Pack B (Chicken)';
    }
    
    // add addOnGroupIds
    await menupacks.updateOne(
      { _id: pack._id },
      {
        $set: { name: newName },
        $addToSet: { addOnGroupIds: addOnGroupId }
      }
    );
    console.log(`Updated pack ${pack.name} -> ${newName} with Rice Selection`);
  }

  process.exit(0);
}
run().catch(console.error);
