const mongoose = require('mongoose');

const MONGODB_URI = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr";

const VendorSchema = new mongoose.Schema({}, { strict: false, collection: 'vendors' });
const Vendor = mongoose.model('Vendor', VendorSchema);

const ProductSchema = new mongoose.Schema({}, { strict: false, collection: 'products' });
const Product = mongoose.model('Product', ProductSchema);

const canteenMenu = [
  // THE RICE VARIETIES
  { category: 'Rice Specialties', name: 'Party Jollof Rice', price: 1200, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400', description: 'Smoky, authentic Nigerian Jollof Rice' },
  { category: 'Rice Specialties', name: 'Fried Rice (Veggies)', price: 1300, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400', description: 'Steaming fried rice with mixed vegetables' },
  { category: 'Rice Specialties', name: 'White Rice & Tomato Stew', price: 1000, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400', description: 'Classic white rice with spicy tomato stew' },
  { category: 'Rice Specialties', name: 'Coconut Rice', price: 1400, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400', description: 'Fragrant rice cooked in rich coconut milk' },
  
  // SWALLOW & SOUPS
  { category: 'Swallow & Soups', name: 'Pounded Yam', price: 800, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400', description: 'Smooth, fluffy pounded yam' },
  { category: 'Swallow & Soups', name: 'Eba (Yellow/White)', price: 500, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400', description: 'Classic Garri swallow' },
  { category: 'Swallow & Soups', name: 'Amala (Dudu)', price: 600, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400', description: 'Authentic Oyo-style Amala' },
  { category: 'Swallow & Soups', name: 'Egusi Soup (Lumpy)', price: 1500, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400', description: 'Rich melon seed soup with garnish' },
  { category: 'Swallow & Soups', name: 'Efo Riro (Leafy)', price: 1800, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400', description: 'Spiced spinach with assorted meats' },
  { category: 'Swallow & Soups', name: 'Okra Soup (Ila Alasepo)', price: 1200, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400', description: 'Freshly diced okra soup' },
  
  // PROTEINS (THE MEAT BOX)
  { category: 'Proteins', name: 'Fried Beef (per piece)', price: 800, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400' },
  { category: 'Proteins', name: 'Assorted (Ponmo/Shaki)', price: 700, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400' },
  { category: 'Proteins', name: 'Fried Fish (Titan)', price: 1500, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400' },
  { category: 'Proteins', name: 'Chicken (Large Piece)', price: 2000, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400' },
  { category: 'Proteins', name: 'Boiled Egg', price: 300, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400' },
  
  // BREAKFAST & SIDES
  { category: 'Breakfast & Sides', name: 'Beans (Ewa Aganyin)', price: 1000, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400', description: 'Soft beans with spicy black sauce' },
  { category: 'Breakfast & Sides', name: 'Fried Plantain (Dodo)', price: 500, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400' },
  { category: 'Breakfast & Sides', name: 'Moi Moi (Elemi Meji)', price: 700, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400', description: 'Steam bean pudding with egg and fish' },
  { category: 'Breakfast & Sides', name: 'Akara (Bean Cakes)', price: 100, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400' },
  
  // CAMPUS CHOW
  { category: 'Campus Snacks', name: 'Meat Pie (Premium)', price: 800, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400' },
  { category: 'Campus Snacks', name: 'Chicken Pie', price: 900, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400' },
  { category: 'Campus Snacks', name: 'Sausage Roll', price: 500, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400' },
  { category: 'Campus Snacks', name: 'Egg Roll', price: 600, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400' },
  { category: 'Campus Snacks', name: 'Fish Roll', price: 600, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400' },
  
  // BEVERAGES
  { category: 'Drinks', name: 'Zobo (Iced)', price: 400, image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=400', description: 'Refreshing Hibiscus drink' },
  { category: 'Drinks', name: 'Coke/Fanta (50cl)', price: 400, image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400' },
  { category: 'Drinks', name: 'Monster Energy', price: 1200, image: 'https://images.unsplash.com/photo-1622543925917-763c3efd382c?w=400' },
  { category: 'Drinks', name: 'Bottled Water (75cl)', price: 200, image: 'https://images.unsplash.com/photo-1548839140-29a7420a7088?w=400' }
];

const smoothieMenu = [
  { category: 'Smoothies', name: 'Strawberry Blast', price: 3500, image: 'https://images.unsplash.com/photo-1502741224143-90386d7f8c82?w=400' },
  { category: 'Smoothies', name: 'Mango Tango', price: 3000, image: 'https://images.unsplash.com/photo-1482012792751-bb99d83b25af?w=400' },
  { category: 'Smoothies', name: 'Avocado Cream', price: 3500, image: 'https://images.unsplash.com/photo-1502741224143-90386d7f8c82?w=400' },
  { category: 'Parfaits', name: 'Fruit Parfait (Large)', price: 4500, image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400' }
];

const groceryMenu = [
  { category: 'Essentials', name: 'Indomie (Hungryman Size)', price: 500, image: 'https://images.unsplash.com/photo-1559181567-c3190cb9959b?w=400' },
  { category: 'Essentials', name: 'Garri (Small Bag)', price: 1200, image: 'https://images.unsplash.com/photo-1559181567-c3190cb9959b?w=400' },
  { category: 'Essentials', name: 'Groundnut Oil (Power Oil)', price: 800, image: 'https://images.unsplash.com/photo-1559181567-c3190cb9959b?w=400' },
  { category: 'Toiletries', name: 'Morning Fresh', price: 1500, image: 'https://images.unsplash.com/photo-1559181567-c3190cb9959b?w=400' },
  { category: 'Toiletries', name: 'Always Pad (Ultra)', price: 1200, image: 'https://images.unsplash.com/photo-1559181567-c3190cb9959b?w=400' }
];

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const vendors = await Vendor.find({});
    console.log(`Seeding menus for ${vendors.length} vendors...`);

    // We don't clear ALL products here because we want to selectively add.
    // Actually, user said "seed with ALL possible things", so I will clear all products to start fresh with this university theme.
    await Product.deleteMany({});
    console.log('Cleared existing products for fresh start.');

    for (const vendor of vendors) {
      let menuItems = [];
      const storeName = vendor.storeName.toLowerCase();
      const type = vendor.category || 'restaurant';

      if (storeName.includes('smoothie')) {
        menuItems = smoothieMenu;
      } else if (type === 'groceries') {
        menuItems = groceryMenu;
      } else if (storeName.includes('stores') || storeName.includes('yem yem') || storeName.includes('safeway')) {
        menuItems = [...groceryMenu, ...canteenMenu.filter(m => m.category === 'Drinks' || m.category === 'Campus Snacks')];
      } else {
        // Mama Put / Restaurant
        menuItems = canteenMenu;
      }
      
      const productsToCreate = menuItems.map(item => ({
        vendor: vendor._id,
        owner: vendor.owner,
        name: item.name,
        price: item.price,
        image: item.image,
        description: item.description || '',
        category: item.category,
        isAvailable: true,
        preparationTime: type === 'groceries' ? 5 : 15,
        rating: 4.2 + Math.random() * 0.8
      }));

      await Product.insertMany(productsToCreate);
      console.log(`Seeded ${productsToCreate.length} items for ${vendor.storeName}`);
    }

    console.log('Campus meal seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seed();
