const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;
console.log('Using MONGODB_URI:', MONGODB_URI);

const schemaOpts = { strict: false };
const User = mongoose.model('User', new mongoose.Schema({}, { ...schemaOpts, collection: 'users' }));
const Vendor = mongoose.model('Vendor', new mongoose.Schema({}, { ...schemaOpts, collection: 'vendors' }));

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB.');

    const email = 'auntyiyabo.vendor@errandr.com';
    const passwordHash = await bcrypt.hash('Test@1234', 12);

    const user = await User.findOneAndUpdate(
      { email: email },
      { $set: { password: passwordHash, isVerified: true, isActive: true } },
      { new: true }
    );

    if (!user) {
      console.error(`User with email ${email} not found!`);
      process.exit(1);
    }

    console.log('Updated user successfully:', {
      _id: user._id,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      isActive: user.isActive
    });

    const vendor = await Vendor.findOne({ owner: user._id });
    if (vendor) {
      console.log('Vendor Store Info:', {
        _id: vendor._id,
        storeName: vendor.storeName,
        isOnline: vendor.isOnline,
        status: vendor.status
      });
    } else {
      console.log('No vendor store found linked to this user ID!');
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
