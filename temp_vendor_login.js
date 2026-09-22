const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

// Minimal schemas to update the user
const vendorSchema = new mongoose.Schema({
  storeName: String,
  owner: mongoose.Schema.Types.ObjectId,
}, { collection: 'vendors' }); 

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
}, { collection: 'users' });

const Vendor = mongoose.model('Vendor', vendorSchema);
const User = mongoose.model('User', userSchema);

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);

    // Find the vendor
    const vendor = await Vendor.findOne({ storeName: /MUM-JAY ABULA/i });
    if (!vendor) {
      console.log('Vendor not found.');
      return;
    }

    // Find the associated user
    const user = await User.findById(vendor.owner);
    if (!user) {
      console.log('Owner user not found.');
      return;
    }

    // Create a temporary password
    const tempPassword = 'TempPassword123!';
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    // Save the old hash if we want to log it
    const oldHash = user.password;

    // Update the password
    user.password = hashedPassword;
    await user.save();

    console.log('\n--- Temporary Vendor Login Created ---');
    console.log(`Store Name: ${vendor.storeName}`);
    console.log(`Email: ${user.email}`);
    console.log(`Password: ${tempPassword}`);
    console.log(`\n(Old Password Hash: ${oldHash})`);
    console.log('--------------------------------------\n');

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

main();
