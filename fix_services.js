const mongoose = require('mongoose');

async function fix() {
  await mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr');
  const db = mongoose.connection.db;

  const services = await db.collection('services').find({}).toArray();
  let updated = 0;

  for (const s of services) {
    // If s.vendor is actually a User ID, let's find the Vendor
    const vendor = await db.collection('vendors').findOne({ owner: s.vendor });
    if (vendor) {
      // It means s.vendor was the user ID! Update it to vendor._id
      await db.collection('services').updateOne(
        { _id: s._id },
        { $set: { vendor: vendor._id } }
      );
      updated++;
      console.log(`Updated service ${s.name} from owner ${s.vendor} to vendor ${vendor._id}`);
    }
  }

  console.log(`Finished fixing ${updated} services.`);
  process.exit(0);
}

fix().catch(console.error);
