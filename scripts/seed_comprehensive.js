const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = "mongodb+srv://erranders:erranders@erranders.eknah3x.mongodb.net/?appName=erranders";

const userSchema = new mongoose.Schema({}, { strict: false, collection: 'users' });
const User = mongoose.model('User', userSchema);

const VendorSchema = new mongoose.Schema({}, { strict: false, collection: 'vendors' });
const Vendor = mongoose.model('Vendor', VendorSchema);

const ProductSchema = new mongoose.Schema({}, { strict: false, collection: 'products' });
const Product = mongoose.model('Product', ProductSchema);

const menus = {
  restaurant: [
    { category: 'Main Dishes', name: 'Jollof Rice', price: 1500, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400' },
    { category: 'Main Dishes', name: 'Fried Rice', price: 1600, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400' },
    { category: 'Sides', name: 'Fried Plantain', price: 500, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400' },
    { category: 'Sides', name: 'Chicken (Fried)', price: 1200, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400' },
    { category: 'Traditional', name: 'Egusi Soup & Pounded Yam', price: 2500, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400' },
    { category: 'Drinks', name: 'Coca-Cola (50cl)', price: 400, image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400' }
  ],
  eatery: [
    { category: 'Meals', name: 'Beef Burger', price: 3500, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400' },
    { category: 'Meals', name: 'Chicken Wings', price: 2800, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400' },
    { category: 'Sides', name: 'French Fries', price: 1000, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400' }
  ],
  bakery: [
    { category: 'Bread', name: 'Agege Bread (Fresh)', price: 800, image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400' },
    { category: 'Pastries', name: 'Meat Pie', price: 700, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400' },
    { category: 'Pastries', name: 'Sausage Roll', price: 500, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400' }
  ],
  groceries: [
    { category: 'Dairy', name: 'Cowbell Milk (Refill)', price: 1200, image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400' },
    { category: 'Grains', name: 'Golden Penny Rice (1kg)', price: 1500, image: 'https://images.unsplash.com/photo-1559181567-c3190cb9959b?w=400' },
    { category: 'Beverages', name: 'Milo (Tin)', price: 4500, image: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400' }
  ]
};

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // 1. Fix Iya Chidera specifically
    const loggedInEmail = 'iya.chidera.vendor@erranders.org';
    const scriptEmail = 'iyachidera.vendor@erranders.org';
    
    let loggedInUser = await User.findOne({ email: loggedInEmail });
    const vendorIya = await Vendor.findOne({ storeName: 'Iya Chidera' });

    if (loggedInUser && vendorIya) {
      console.log(`Fixing Iya Chidera ownership to ${loggedInEmail}`);
      await Vendor.updateOne({ _id: vendorIya._id }, { $set: { owner: loggedInUser._id } });
      await Product.updateMany({ vendor: vendorIya._id }, { $set: { owner: loggedInUser._id } });
    }

    // 2. Seed Menus for all vendors
    const vendors = await Vendor.find({});
    console.log(`Seeding menus for ${vendors.length} vendors...`);

    // Clear all existing products first to avoid duplicates
    await Product.deleteMany({});
    console.log('Cleared existing products.');

    for (const vendor of vendors) {
      const cat = vendor.category || 'restaurant';
      const menuItems = menus[cat] || menus.restaurant;
      
      const productsToCreate = menuItems.map(item => ({
        vendor: vendor._id,
        owner: vendor.owner,
        name: item.name,
        price: item.price,
        image: item.image,
        category: item.category,
        isAvailable: true,
        preparationTime: 15,
        rating: 4.5 + Math.random() * 0.5
      }));

      await Product.insertMany(productsToCreate);
      console.log(`Seeded ${productsToCreate.length} items for ${vendor.storeName}`);
    }

    console.log('Comprehensive seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seed();
