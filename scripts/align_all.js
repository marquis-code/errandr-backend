const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = "mongodb+srv://erranders:erranders@erranders.eknah3x.mongodb.net/?appName=erranders";

const userSchema = new mongoose.Schema({}, { strict: false, collection: 'users' });
const User = mongoose.model('User', userSchema);

const VendorSchema = new mongoose.Schema({}, { strict: false, collection: 'vendors' });
const Vendor = mongoose.model('Vendor', VendorSchema);

const ProductSchema = new mongoose.Schema({}, { strict: false, collection: 'products' });
const Product = mongoose.model('Product', ProductSchema);

async function alignAndSeed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const passwordHash = await bcrypt.hash('Erranders2026!', 12);
    
    // 1. Dispatch Rider
    let rider = await User.findOne({ email: 'rider@erranders.org' });
    if (!rider) {
      rider = await User.create({
        firstName: 'Speedy',
        lastName: 'Rider',
        email: 'rider@erranders.org',
        password: passwordHash,
        role: 'errander',
        isVerified: true,
        walletBalance: 0,
        vehicleType: 'motorcycle',
        isOnline: true
      });
      console.log('Dispatch Rider created successfully!');
    }
    console.log('\n--- DISPATCH RIDER CREDENTIALS ---');
    console.log('Email: rider@erranders.org');
    console.log('Password: Erranders2026!');
    console.log('----------------------------------\n');

    // 2. Align All Vendors
    const vendors = await Vendor.find({});
    console.log(`Found ${vendors.length} vendors to align...`);

    const vendorLogins = [];

    for (const vendor of vendors) {
      const emailDomain = 'erranders.com';
      const cleanName = (vendor.storeName || 'Vendor').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const email = `${cleanName}.vendor@${emailDomain}`;

      let user = await User.findOne({ email });
      if (!user) {
        user = await User.create({
          firstName: (vendor.storeName || 'Vendor').split(' ')[0] || 'Vendor',
          lastName: (vendor.storeName || 'Store').split(' ').slice(1).join(' ') || 'Store',
          email,
          password: passwordHash,
          role: 'vendor',
          isVerified: true,
          walletBalance: 0
        });
      }

      // Update Vendor Owner
      await Vendor.updateOne({ _id: vendor._id }, { $set: { owner: user._id } });
      
      // Update Products Owner
      await Product.updateMany(
        { vendor: vendor._id },
        { $set: { owner: user._id } }
      );

      vendorLogins.push({ store: vendor.storeName, email });
    }

    console.log('--- VENDOR CREDENTIALS (All passwords: Erranders2026!) ---');
    vendorLogins.forEach(v => {
      console.log(`Store: ${(v.store || 'Vendor').padEnd(20)} | Email: ${v.email}`);
    });
    console.log('--------------------------------------------------------\n');

    console.log('Alignment completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Alignment failed:', error);
    process.exit(1);
  }
}

alignAndSeed();
