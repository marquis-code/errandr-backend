const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;
console.log('Using MONGODB_URI:', MONGODB_URI);

const schemaOpts = { strict: false };
const User = mongoose.model('User', new mongoose.Schema({}, { ...schemaOpts, collection: 'users' }));
const Vendor = mongoose.model('Vendor', new mongoose.Schema({}, { ...schemaOpts, collection: 'vendors' }));
const Product = mongoose.model('Product', new mongoose.Schema({}, { ...schemaOpts, collection: 'products' }));

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected successfully to MongoDB.');

    const user = await User.findOne({ email: 'dobiecakes@gmail.com' });
    console.log('\n--- USER RECORD ---');
    if (!user) {
      console.log('User dobiecakes@gmail.com NOT found!');
      process.exit(1);
    }
    console.log(JSON.stringify(user.toObject(), null, 2));

    const vendors = await Vendor.find({ owner: user._id });
    console.log('\n--- VENDORS OWNED BY USER ---');
    console.log(`Found ${vendors.length} vendors`);
    for (const v of vendors) {
      console.log(JSON.stringify(v.toObject(), null, 2));
    }

    const allVendors = await Vendor.find({ storeName: /dobi/i });
    console.log('\n--- ALL VENDORS WITH "dobi" IN STORE NAME ---');
    console.log(`Found ${allVendors.length} vendors`);
    for (const v of allVendors) {
      console.log('Vendor StoreName:', v.storeName, 'ID:', v._id, 'Owner ID:', v.owner);
      const ownerUser = await User.findById(v.owner);
      console.log('  Owner Email:', ownerUser ? ownerUser.email : 'NOT FOUND');
      
      const productsCount = await Product.countDocuments({ vendor: v._id });
      console.log(`  Products Count: ${productsCount}`);

      const productsWithOwnerCount = await Product.countDocuments({ owner: v.owner });
      console.log(`  Products with owner=${v.owner} Count: ${productsWithOwnerCount}`);
    }

    if (vendors.length > 0) {
      const firstVendorId = vendors[0]._id;
      const products = await Product.find({ vendor: firstVendorId });
      console.log(`\n--- PRODUCTS BELONGING TO VENDOR ${firstVendorId} ---`);
      console.log(`Found ${products.length} products`);
      if (products.length > 0) {
        console.log('Sample product:', JSON.stringify(products[0].toObject(), null, 2));
      }
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
