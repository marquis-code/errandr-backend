const mongoose = require('mongoose');

const MONGODB_URI = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr";

// We'll define simple schemas to just insert the data directly
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

    const email = `test.vendor.${Date.now()}@erranders.org`;
    const subdomain = `tasty-bites-${Math.floor(Math.random() * 1000)}`;

    console.log('Creating User...');
    const user = new User({
      firstName: 'Tasty',
      lastName: 'Bites Owner',
      email: email,
      password: 'password123',
      role: 'vendor',
      isActive: true,
      isVerified: true
    });
    await user.save();

    console.log('Creating Vendor...');
    const vendor = new Vendor({
      owner: user._id,
      storeName: 'Tasty Bites',
      subdomain: subdomain,
      description: 'The best burgers and fries on campus. Guaranteed to cure Sapa!',
      logo: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=200&h=200&fit=crop',
      banner: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&h=400&fit=crop',
      category: 'restaurant',
      tags: ['restaurant', 'burgers', 'fast food'],
      status: 'approved',
      isOnline: true,
      rating: 4.8,
      totalOrders: 156,
      totalRatings: 42,
      preparationTime: 15,
      baseDeliveryFee: 500,
      isInsideCampus: true,
      address: 'Main Campus Food Court'
    });
    await vendor.save();

    console.log('Creating Products...');
    const products = [
      {
        vendor: vendor._id,
        name: 'Classic Cheeseburger',
        description: 'Juicy beef patty with melted cheddar cheese, lettuce, and our secret sauce.',
        price: 2500,
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop',
        category: 'Burgers',
        isAvailable: true,
        preparationTime: 10,
        stockQuantity: -1,
      },
      {
        vendor: vendor._id,
        name: 'Spicy Chicken Wings',
        description: '6 pieces of crispy chicken wings tossed in fiery buffalo sauce.',
        price: 3000,
        image: 'https://images.unsplash.com/photo-1569691899455-88464f6d3cb1?w=400&h=300&fit=crop',
        category: 'Chicken',
        isAvailable: true,
        preparationTime: 15,
        stockQuantity: -1,
      },
      {
        vendor: vendor._id,
        name: 'Loaded Fries',
        description: 'Crispy french fries topped with cheese sauce, bacon bits, and jalapenos.',
        price: 2000,
        image: 'https://images.unsplash.com/photo-1518013431119-2ce69829f958?w=400&h=300&fit=crop',
        category: 'Sides',
        isAvailable: true,
        preparationTime: 5,
        stockQuantity: -1,
      }
    ];
    await Product.insertMany(products);

    console.log('\\n--- SEED SUCCESSFUL ---');
    console.log(`Subdomain: ${subdomain}`);
    console.log(`URL to test: http://${subdomain}.localhost:3001`);
    console.log(`(If using a different host, replace localhost with your dev host, e.g. http://${subdomain}.192.168.x.x:3001)`);
    console.log('------------------------\\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error seeding data:', err);
    process.exit(1);
  }
}

seed();
