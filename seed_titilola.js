const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr";

const UserSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: String,
  password: String,
  role: String,
  isActive: Boolean,
  isVerified: Boolean
}, { timestamps: true });

const VendorSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  storeName: String,
  subdomain: String,
  description: String,
  logo: String,
  banner: String,
  category: String,
  tags: [String],
  status: String,
  isOnline: Boolean,
  rating: Number,
  totalOrders: Number,
  totalRatings: Number,
  preparationTime: Number,
  baseDeliveryFee: Number,
  isInsideCampus: Boolean,
  serviceLocation: String,
  address: String,
}, { timestamps: true });

const ProductSchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
  name: String,
  description: String,
  price: Number,
  image: String,
  category: String,
  isAvailable: Boolean,
  preparationTime: Number,
  stockQuantity: Number,
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Vendor = mongoose.models.Vendor || mongoose.model('Vendor', VendorSchema);
const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);

async function seed() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected.');

    const email = `titilola@gmail.com`;
    const subdomain = `siora-essence`;

    console.log('Creating User...');
    // Delete existing user and vendor if they exist to avoid duplicate issues during seed test
    await User.deleteOne({ email: email });
    await Vendor.deleteOne({ subdomain: subdomain });

    const passwordHash = await bcrypt.hash('password123', 12);
    const user = new User({
      firstName: 'Titilola',
      lastName: 'Mabayoge',
      email: email,
      password: passwordHash,
      role: 'vendor',
      isActive: true,
      isVerified: true
    });
    await user.save();

    console.log('Creating Vendor...');
    const vendor = new Vendor({
      owner: user._id,
      storeName: 'Siora Essence',
      subdomain: subdomain,
      description: 'Quiet Pieces. Loud Confidence.',
      logo: 'https://images.unsplash.com/photo-1584916201218-f4242ceb4809?w=200&h=200&fit=crop',
      banner: 'https://images.unsplash.com/photo-1584916201218-f4242ceb4809?w=800&h=400&fit=crop',
      category: 'fashion',
      tags: ['bags', 'fashion', 'accessories'],
      status: 'approved',
      isOnline: true,
      rating: 5.0,
      totalOrders: 0,
      totalRatings: 0,
      preparationTime: 60,
      baseDeliveryFee: 1500,
      isInsideCampus: false,
      serviceLocation: 'virtual_online',
      address: 'Online Store'
    });
    await vendor.save();

    console.log('Creating Products...');
    // Clean up products for this vendor if re-running
    await Product.deleteMany({ vendor: vendor._id });

    const products = [
      {
        vendor: vendor._id,
        name: 'Nude Shoulder Bag',
        description: 'Size: Small',
        price: 8000,
        image: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=400&h=300&fit=crop',
        category: 'Bags',
        isAvailable: true,
        preparationTime: 60,
        stockQuantity: -1,
      },
      {
        vendor: vendor._id,
        name: 'Black croc leather shoulder bag',
        description: 'Size: medium',
        price: 9000,
        image: 'https://images.unsplash.com/photo-1584916201218-f4242ceb4809?w=400&h=300&fit=crop',
        category: 'Bags',
        isAvailable: true,
        preparationTime: 60,
        stockQuantity: -1,
      },
      {
        vendor: vendor._id,
        name: 'Black Shoulder Bag',
        description: 'Size: Small',
        price: 9000,
        image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&h=300&fit=crop',
        category: 'Bags',
        isAvailable: true,
        preparationTime: 60,
        stockQuantity: -1,
      },
      {
        vendor: vendor._id,
        name: 'Off white shoulder bag',
        description: 'Size: Small',
        price: 9000,
        image: 'https://images.unsplash.com/photo-1591561954557-26941169b49e?w=400&h=300&fit=crop',
        category: 'Bags',
        isAvailable: true,
        preparationTime: 60,
        stockQuantity: -1,
      },
      {
        vendor: vendor._id,
        name: 'Black Shoulder Bag (Alt)',
        description: 'Size: Small',
        price: 7500,
        image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&h=300&fit=crop',
        category: 'Bags',
        isAvailable: true,
        preparationTime: 60,
        stockQuantity: -1,
      },
      {
        vendor: vendor._id,
        name: 'Quality black bag',
        description: 'It has another longer handle. Size: Medium',
        price: 9500,
        image: 'https://images.unsplash.com/photo-1584916201218-f4242ceb4809?w=400&h=300&fit=crop',
        category: 'Bags',
        isAvailable: true,
        preparationTime: 60,
        stockQuantity: -1,
      }
    ];
    await Product.insertMany(products);

    console.log('\\n--- SEED SUCCESSFUL ---');
    console.log(`Subdomain: ${subdomain}`);
    console.log(`URL to test: http://${subdomain}.localhost:3001`);
    console.log('------------------------\\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error seeding data:', err);
    process.exit(1);
  }
}

seed();
