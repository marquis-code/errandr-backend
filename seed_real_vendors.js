const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr";

// Schemas (simplified for script use)
const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: { type: String, unique: true },
  password: { type: String },
  role: { type: String, default: 'student' },
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
  isAvailable: { type: Boolean, default: true },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Vendor = mongoose.model('Vendor', vendorSchema);
const ProductCategory = mongoose.model('ProductCategory', productCategorySchema);
const Product = mongoose.model('Product', productSchema);

const vendorsRaw = [
  { name: 'Aunty iyabo', type: 'restaurant', specialties: 'Bread and Beans' },
  { name: 'Iya Chidera', type: 'restaurant', specialties: 'Full food' },
  { name: 'Smoothie Daddy', type: 'restaurant', specialties: 'Small chops, Fruits, Smoothies' },
  { name: 'Mavise', type: 'restaurant', specialties: 'Full food' },
  { name: 'Chijoke', type: 'restaurant', specialties: 'Full food' },
  { name: 'Tasty delight', type: 'restaurant', specialties: 'Full food' },
  { name: 'HVIP', type: 'restaurant', specialties: 'Full food' },
  { name: 'Iya waris', type: 'restaurant', specialties: 'Full food' },
  { name: 'Just Spices', type: 'restaurant', specialties: 'Full food' },
  { name: 'Iya Monisca', type: 'restaurant', specialties: 'Full food' },
  { name: 'Yem Yem', type: 'groceries', specialties: 'Complete Supermarket' },
];

const categories = [
  'Rice', 'Meat & Fish', 'Swallows', 'Beans', 'Bread', 'Butter Bread', 'Soft drinks', 'Alcoholic Drinks', 'Energy drinks'
];

const meals = [
  { name: 'Fried Rice', price: 400, cat: 'Rice' },
  { name: 'Jollof Rice', price: 400, cat: 'Rice' },
  { name: 'White Rice', price: 400, cat: 'Rice' },
  { name: 'Pasta', price: 500, cat: 'Rice' },
  { name: 'Noodles & Fried Eggs', price: 2000, cat: 'Rice' },
  { name: 'Meat', price: 200, cat: 'Meat & Fish' },
  { name: 'Ponmo', price: 300, cat: 'Meat & Fish' },
  { name: 'Egg', price: 350, cat: 'Meat & Fish' },
  { name: 'Sausage', price: 400, cat: 'Meat & Fish' },
  { name: 'Titus', price: 1000, cat: 'Meat & Fish' },
  { name: 'Sardine', price: 1500, cat: 'Meat & Fish' },
  { name: 'Chicken', price: 2000, cat: 'Meat & Fish' },
  { name: 'Goat Meat', price: 2500, cat: 'Meat & Fish' },
  { name: 'Turkey', price: 3500, cat: 'Meat & Fish' },
  { name: 'Ewedu Soup', price: 0, cat: 'Swallows' },
  { name: 'Egusi Soup', price: 50, cat: 'Swallows' },
  { name: 'Efo Riro Soup', price: 100, cat: 'Swallows' },
  { name: 'Eba', price: 300, cat: 'Swallows' },
  { name: 'Black Amala', price: 300, cat: 'Swallows' },
  { name: 'Semo', price: 300, cat: 'Swallows' },
  { name: 'White Amala', price: 300, cat: 'Swallows' },
  { name: 'Fufu', price: 300, cat: 'Swallows' },
  { name: 'Poundo', price: 400, cat: 'Swallows' },
  { name: 'Plantain', price: 100, cat: 'Beans' },
  { name: 'Beans', price: 500, cat: 'Beans' },
  { name: 'Butter Bread', price: 1000, cat: 'Bread' },
  { name: 'Shawarma without sausage', price: 1800, cat: 'Bread' },
  { name: 'Bread & Fried Eggs', price: 2000, cat: 'Bread' },
  { name: 'Shawarma with single sausage', price: 2200, cat: 'Bread' },
  { name: 'Shawarma with double sausage', price: 2600, cat: 'Bread' },
  { name: 'Bottle Water', price: 250, cat: 'Soft drinks' },
  { name: 'Lacasera', price: 350, cat: 'Soft drinks' },
  { name: 'Pepsi', price: 600, cat: 'Soft drinks' },
  { name: 'Fanta', price: 600, cat: 'Soft drinks' },
  { name: 'Coca-Cola', price: 600, cat: 'Soft drinks' },
  { name: 'Maltina Pet', price: 700, cat: 'Soft drinks' },
  { name: 'Five Alive (puppy)', price: 800, cat: 'Soft drinks' },
  { name: 'Five Alive (big)', price: 1800, cat: 'Soft drinks' },
  { name: 'Desperado Can', price: 1200, cat: 'Alcoholic Drinks' },
  { name: 'Fearless', price: 600, cat: 'Energy drinks' },
];

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const passwordHash = await bcrypt.hash('Errandr2026!', 12);
    const credentials = [];

    for (const vInfo of vendorsRaw) {
      const email = `${vInfo.name.toLowerCase().replace(/ /g, '.')}.vendor@errandr.com`;
      const password = 'Errandr2026!';

      // 1. Create User
      let user = await User.findOne({ email });
      if (!user) {
        user = await User.create({
          firstName: vInfo.name.split(' ')[0],
          lastName: vInfo.name.split(' ').slice(1).join(' ') || 'Vendor',
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
          description: vInfo.specialties,
          category: vInfo.type,
          status: 'approved',
          isOnline: true,
          operatingHours: { open: '08:00', close: '21:00' },
          rating: 4.5 + Math.random() * 0.5,
          preparationTime: vInfo.type === 'groceries' ? 5 : 20,
          deliveryFee: 150,
          logo: `https://ui-avatars.com/api/?name=${vInfo.name.replace(/ /g, '+')}&background=065fdb&color=fff`,
          banner: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200'
        });
      }

      // 3. Create Product Categories for this vendor
      for (const catName of categories) {
        const catExists = await ProductCategory.findOne({ vendor: vendor._id, name: catName });
        if (!catExists) {
          await ProductCategory.create({ vendor: vendor._id, name: catName });
        }
      }

      // 4. Create Products for this vendor
      for (const meal of meals) {
        const prodExists = await Product.findOne({ vendor: vendor._id, name: meal.name });
        if (!prodExists) {
          await Product.create({
            vendor: vendor._id,
            name: meal.name,
            price: meal.price,
            category: meal.cat,
            image: `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400`,
            isAvailable: true
          });
        }
      }

      credentials.push({ name: vInfo.name, email, password });
      console.log(`Successfully seeded: ${vInfo.name}`);
    }

    console.log('\n--- VENDOR CREDENTIALS ---');
    credentials.forEach(c => {
      console.log(`Vendor: ${c.name}`);
      console.log(`Email: ${c.email}`);
      console.log(`Password: ${c.password}`);
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
