const mongoose = require('mongoose');
const { Schema } = mongoose;
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Vendor = mongoose.model('Vendor', new Schema({}, { strict: false }));
  const User = mongoose.model('User', new Schema({}, { strict: false }));

  const vendors = await Vendor.find({});
  for (const vendor of vendors) {
    if (vendor.owner && typeof vendor.owner === 'object' && !vendor.owner._bsontype) {
      console.log(`Corrupted vendor found: ${vendor.storeName} (${vendor._id})`);
      console.log(`Owner:`, vendor.owner);
      
      let user;
      if (vendor.owner.email) {
        user = await User.findOne({ email: vendor.owner.email });
      }
      
      if (user) {
        await Vendor.updateOne({ _id: vendor._id }, { $set: { owner: user._id } });
        console.log("Fixed! New owner ID:", user._id);
      } else {
        console.log("User not found by email, trying to search by phone...");
        user = await User.findOne({ phone: vendor.owner.phone });
        if (user) {
          await Vendor.updateOne({ _id: vendor._id }, { $set: { owner: user._id } });
          console.log("Fixed! New owner ID:", user._id);
        } else {
          console.log("Could not find user.");
        }
      }
    }
  }
  
  mongoose.disconnect();
}
run();
