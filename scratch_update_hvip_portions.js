const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const vendors = mongoose.connection.collection('vendors');
  const addongroups = mongoose.connection.collection('addongroups');

  const vendor = await vendors.findOne({ storeName: /HVIP/i });

  if (vendor) {
    const group = await addongroups.findOne({ vendorId: vendor._id, name: 'Rice Selection' });
    if (group) {
      const updatedAddons = group.addons.map(addon => {
        addon.name = addon.name.replace('3 Portions', '4 Portions');
        return addon;
      });
      await addongroups.updateOne(
        { _id: group._id },
        { $set: { addons: updatedAddons } }
      );
      console.log('Updated Rice Selection addons to 4 Portions');
    } else {
      console.log('Rice Selection AddOnGroup not found');
    }
  } else {
    console.log('HVIP Vendor not found');
  }

  process.exit(0);
}
run().catch(console.error);
