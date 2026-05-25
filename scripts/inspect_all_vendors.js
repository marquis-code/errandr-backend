const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

const schemaOpts = { strict: false };
const User = mongoose.model('User', new mongoose.Schema({}, { ...schemaOpts, collection: 'users' }));
const Vendor = mongoose.model('Vendor', new mongoose.Schema({}, { ...schemaOpts, collection: 'vendors' }));
const Product = mongoose.model('Product', new mongoose.Schema({}, { ...schemaOpts, collection: 'products' }));

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected successfully to MongoDB.');

    const vendors = await Vendor.find({});
    console.log(`\n--- ALL VENDORS & THEIR PRODUCTS COUNT ---`);
    console.log(`Found ${vendors.length} vendors in DB\n`);

    console.log(
      '%-24s | %-32s | %-24s | %s'.replace(/%/g, ''),
      'Store Name'.padEnd(24),
      'Owner Email'.padEnd(32),
      'Vendor ID'.padEnd(24),
      'Products Count'
    );
    console.log('-'.repeat(95));

    for (const v of vendors) {
      const owner = await User.findById(v.owner);
      const email = owner ? owner.email : 'NO OWNER / DELETED';
      const count = await Product.countDocuments({ vendor: v._id });
      console.log(
        '%-24s | %-32s | %-24s | %d',
        (v.storeName || 'Unnamed').substring(0, 24).padEnd(24),
        email.substring(0, 32).padEnd(32),
        v._id.toString().padEnd(24),
        count
      );
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
