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

    const totalProducts = await Product.countDocuments({});
    console.log(`Total Products in DB: ${totalProducts}`);

    if (totalProducts > 0) {
      const sampleProducts = await Product.find({}).limit(5);
      console.log('\n--- SAMPLE PRODUCTS ---');
      for (const p of sampleProducts) {
        console.log({
          id: p._id,
          name: p.name,
          vendor: p.vendor,
          category: p.category,
          price: p.price
        });
      }

      // Group products by vendor
      const aggregation = await Product.aggregate([
        { $group: { _id: '$vendor', count: { $sum: 1 } } }
      ]);
      console.log('\n--- PRODUCTS BY VENDOR ID ---');
      for (const group of aggregation) {
        const vendor = await Vendor.findById(group._id);
        console.log(`Vendor ID: ${group._id} | StoreName: ${vendor ? vendor.storeName : 'NOT FOUND'} | Count: ${group.count}`);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
