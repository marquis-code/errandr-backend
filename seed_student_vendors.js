const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr";

// Simplified Schemas for script use
const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: { type: String, unique: true },
  password: { type: String },
  role: { type: String, default: 'vendor' },
  isVerified: { type: Boolean, default: true },
}, { timestamps: true });

const vendorSchema = new mongoose.Schema({
  owner: mongoose.Schema.Types.ObjectId,
  storeName: { type: String, required: true },
  description: String,
  category: String,
  status: { type: String, default: 'approved' },
  isOnline: { type: Boolean, default: true },
  operatingHours: {
    open: { type: String, default: '08:00' },
    close: { type: String, default: '20:00' },
  },
  rating: { type: Number, default: 0 },
  preparationTime: { type: Number, default: 20 },
  deliveryFee: { type: Number, default: 150 },
  logo: String,
  banner: String,
  subdomain: { type: String, unique: true },
}, { timestamps: true });

const productCategorySchema = new mongoose.Schema({
  vendor: mongoose.Schema.Types.ObjectId,
  name: String,
}, { timestamps: true });

const productSchema = new mongoose.Schema({
  vendor: mongoose.Schema.Types.ObjectId,
  name: String,
  price: Number,
  category: String,
  image: String,
  description: String,
  isAvailable: { type: Boolean, default: true },
}, { timestamps: true });

const serviceSchema = new mongoose.Schema({
  vendor: mongoose.Schema.Types.ObjectId,
  name: String,
  description: String,
  price: Number,
  category: String,
  durationInMinutes: Number,
  paddingTimeInMinutes: { type: Number, default: 0 },
  isAvailable: { type: Boolean, default: true },
  totalBookings: { type: Number, default: 0 },
  rating: { type: Number, default: 0 },
  variants: Array,
  extras: Array,
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', userSchema);
const Vendor = mongoose.models.Vendor || mongoose.model('Vendor', vendorSchema);
const ProductCategory = mongoose.models.ProductCategory || mongoose.model('ProductCategory', productCategorySchema);
const Product = mongoose.models.Product || mongoose.model('Product', productSchema);
const Service = mongoose.models.Service || mongoose.model('Service', serviceSchema);

const vendorsData = [
  {
    // Vendor 1: Physical products only
    name: 'Kicks by Tobi',
    type: 'fashion',
    subdomain: 'kicksbytobi',
    description: 'Affordable and trendy sneakers for students. No physical shop, we deliver to your hostel manually!',
    ownerFirst: 'Tobi',
    ownerLast: 'Sneakers',
    productCategories: ['Sneakers', 'Slides'],
    products: [
      { name: 'Nike Air Force 1', price: 25000, cat: 'Sneakers', desc: 'Crisp white AF1s, sizes 40-45' },
      { name: 'Jordan 4 Retro', price: 45000, cat: 'Sneakers', desc: 'Premium quality Jordan 4s' },
      { name: 'Yeezy Slides', price: 15000, cat: 'Slides', desc: 'Comfortable slides for casual wear' },
    ],
    services: [],
  },
  {
    // Vendor 2: Physical products AND services
    name: 'Mimi Pastries',
    type: 'food',
    subdomain: 'mimipastries',
    description: 'Student baker. I sell cupcakes daily, and you can also book me to bake for your birthdays and events!',
    ownerFirst: 'Mimi',
    ownerLast: 'Baker',
    productCategories: ['Cupcakes', 'Whole Cakes'],
    products: [
      { name: 'Red Velvet Cupcake (Pack of 6)', price: 4500, cat: 'Cupcakes', desc: 'Moist red velvet with cream cheese' },
      { name: 'Vanilla Sponge Cake (Mini)', price: 8000, cat: 'Whole Cakes', desc: 'Perfect for small celebrations' },
    ],
    services: [
      { name: 'Event Cake Baking & Setup', price: 50000, duration: 180, category: 'Baking', desc: 'Book me to bake and set up a dessert table for your departmental dinner or birthday party.' },
      { name: '1-on-1 Baking Masterclass', price: 15000, duration: 120, category: 'Training', desc: 'Learn how to bake simple cakes in your hostel kitchenette.' },
    ],
  },
  {
    // Vendor 3: Services only
    name: 'TechBro Repairs',
    type: 'services',
    subdomain: 'techbrorepairs',
    description: 'Expert laptop and phone repairs right here on campus. I offer software installation and hardware fixes.',
    ownerFirst: 'David',
    ownerLast: 'Tech',
    productCategories: [],
    products: [],
    services: [
      { name: 'Laptop OS Installation', price: 5000, duration: 60, category: 'Software', desc: 'Install Windows 10/11 or Ubuntu.' },
      { name: 'Phone Screen Replacement', price: 15000, duration: 45, category: 'Hardware', desc: 'Replace cracked iPhone or Android screens (price is for workmanship, screen cost varies).' },
      { name: 'Virus Removal & Optimization', price: 3000, duration: 30, category: 'Software', desc: 'Clean up your slow laptop and install antivirus.' },
    ],
  }
];

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const passwordHash = await bcrypt.hash('Erranders2026!', 12);
    const credentials = [];

    for (const vInfo of vendorsData) {
      const email = `${vInfo.subdomain}@erranders.org`;

      // 1. Create User
      let user = await User.findOne({ email });
      if (!user) {
        user = await User.create({
          firstName: vInfo.ownerFirst,
          lastName: vInfo.ownerLast,
          email,
          password: passwordHash,
          role: 'vendor',
          isVerified: true
        });
      }

      // 2. Create Vendor
      let vendor = await Vendor.findOne({ storeName: vInfo.name });
      if (!vendor) {
        vendor = await Vendor.create({
          owner: user._id,
          storeName: vInfo.name,
          description: vInfo.description,
          category: vInfo.type,
          subdomain: vInfo.subdomain,
          status: 'approved',
          isOnline: true,
          operatingHours: { open: '08:00', close: '21:00' },
          rating: 4.8,
          preparationTime: 30,
          deliveryFee: 200,
          logo: `https://ui-avatars.com/api/?name=${vInfo.name.replace(/ /g, '+')}&background=random&color=fff`,
          banner: 'https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?w=1200'
        });
      } else {
        // Update to make sure it matches
        await Vendor.updateOne({ _id: vendor._id }, {
          subdomain: vInfo.subdomain,
          category: vInfo.type,
          description: vInfo.description,
          logo: `https://ui-avatars.com/api/?name=${vInfo.name.replace(/ /g, '+')}&background=random&color=fff`,
        });
      }

      // Clear existing for this vendor for clean slate
      await Product.deleteMany({ vendor: vendor._id });
      await ProductCategory.deleteMany({ vendor: vendor._id });
      await Service.deleteMany({ vendor: vendor._id });

      // 3. Create Product Categories
      for (const catName of vInfo.productCategories) {
        await ProductCategory.create({ vendor: vendor._id, name: catName });
      }

      // 4. Create Products
      for (const prod of vInfo.products) {
        await Product.create({
          vendor: vendor._id,
          name: prod.name,
          price: prod.price,
          category: prod.cat,
          description: prod.desc,
          image: `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400`,
          isAvailable: true
        });
      }

      // 5. Create Services
      for (const srv of vInfo.services) {
        await Service.create({
          vendor: vendor._id,
          name: srv.name,
          price: srv.price,
          category: srv.category,
          description: srv.desc,
          durationInMinutes: srv.duration,
          image: `https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400`,
          isAvailable: true
        });
      }

      credentials.push({ name: vInfo.name, subdomain: vInfo.subdomain, email, password: 'Erranders2026!' });
      console.log(`Successfully seeded: ${vInfo.name}`);
    }

    console.log('\n--- VENDOR CREDENTIALS ---');
    credentials.forEach(c => {
      console.log(`Vendor: ${c.name} (${c.subdomain})`);
      console.log(`Email: ${c.email}`);
      console.log(`Password: ${c.password}`);
      console.log(`Test link: http://${c.subdomain}.localhost:3005/`);
      console.log('---');
    });

    console.log('\nSeeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seed();
