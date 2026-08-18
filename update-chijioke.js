const mongoose = require('mongoose');
const { Types } = mongoose;

async function run() {
  await mongoose.connect('mongodb://localhost:27017/erranders'); // Use actual URI from process.env if needed, or check .env
  
  const Vendor = mongoose.connection.collection('vendors');
  const MenuItem = mongoose.connection.collection('menuitems');

  const chijioke = await Vendor.findOne({ storeName: { $regex: /Chijioke/i } });
  if (!chijioke) {
    console.log("Chijioke vendor not found");
    process.exit(1);
  }
  
  console.log(`Found vendor: ${chijioke.storeName} (${chijioke._id})`);

  const items = await MenuItem.find({ vendorId: chijioke._id }).toArray();
  let updated = 0;

  for (const item of items) {
    if (item.name.includes('(Premium)') || item.name.includes('(Standard)')) {
      await MenuItem.updateOne({ _id: item._id }, { $set: { isPackagingFeeIncluded: true } });
      console.log(`Updated: ${item.name}`);
      updated++;
    }
  }

  console.log(`Done. Updated ${updated} items.`);
  process.exit(0);
}

run();
