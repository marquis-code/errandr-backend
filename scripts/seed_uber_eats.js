const mongoose = require('mongoose');

// Define Schemas (Minimal)
const VendorSchema = new mongoose.Schema({
  storeName: String,
  category: String,
  isOnline: { type: Boolean, default: true },
  status: { type: String, default: 'approved' },
  banners: [Object],
  offers: [String],
  rating: { type: Number, default: 4.8 },
  totalRatings: { type: Number, default: 700 },
  preparationTime: { type: Number, default: 15 },
});

const ProductSchema = new mongoose.Schema({
  vendor: mongoose.Schema.Types.ObjectId,
  name: String,
  price: Number,
  discountPrice: Number,
  discountPercentage: Number,
  category: String,
  image: String,
});

const Vendor = mongoose.model('Vendor', VendorSchema);
const Product = mongoose.model('Product', ProductSchema);

async function seed() {
  await mongoose.connect('mongodb+srv://erranders:erranders@erranders.eknah3x.mongodb.net/?appName=erranders');
  console.log('Connected to MongoDB');

  // Clear existing Safeway-like data
  await Vendor.deleteMany({ storeName: 'Safeway' });
  
  const safeway = await Vendor.create({
    storeName: 'Safeway',
    category: 'groceries',
    isOnline: true,
    status: 'approved',
    offers: ['Free Item (Spend $22)', 'Items on sale'],
    rating: 4.8,
    totalRatings: 750,
    preparationTime: 13,
    banners: [
      {
        image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=1000',
        title: 'Huge savings on everyday favorites',
        description: 'Storewide Deals',
        link: '#',
        isActive: true
      },
      {
        image: 'https://images.unsplash.com/photo-1543362906-acfc16c67564?auto=format&fit=crop&q=80&w=1000',
        title: '$0 Delivery Fee + up to 10% off',
        description: 'Try Erranders One for 4 weeks',
        link: '#',
        isActive: true
      }
    ]
  });

  const products = [
    // Stock-up savings
    { name: 'Fruit by the Foot Gushers Fruit Roll-Ups', price: 6.73, discountPrice: 4.73, discountPercentage: 30, category: 'Stock-up savings', image: 'https://images.unsplash.com/photo-1559181567-c3190cb9959b?w=400' },
    { name: 'Cinnamon Toast Crunch Crispy Rice Cereal', price: 7.86, discountPrice: 4.86, discountPercentage: 38, category: 'Stock-up savings', image: 'https://images.unsplash.com/photo-1521483451569-e33803c0330c?w=400' },
    { name: 'Chobani Nonfat Greek Yogurt, Strawberry', price: 2.01, discountPrice: 1.22, discountPercentage: 39, category: 'Stock-up savings', image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400' },
    { name: 'International Delight Coffee Creamer', price: 6.17, discountPrice: 4.17, discountPercentage: 32, category: 'Stock-up savings', image: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400' },
    
    // Fresh Fruit
    { name: 'Fresh Strawberries (1 lb)', price: 10.11, discountPrice: 7.11, discountPercentage: 30, category: 'Fresh Fruit', image: 'https://images.unsplash.com/photo-1464960350473-9e8555f5b9b1?w=400' },
    { name: 'Banana (each)', price: 0.37, discountPrice: 0.37, discountPercentage: 0, category: 'Fresh Fruit', image: 'https://images.unsplash.com/photo-1571771894821-ad99c99ec20b?w=400' },
    { name: 'Organic Blueberries (6 oz)', price: 6.99, discountPrice: 4.99, discountPercentage: 28, category: 'Fresh Fruit', image: 'https://images.unsplash.com/photo-1497534446932-c946e7316a05?w=400' },
    
    // Best sellers
    { name: 'Signature Select Pure Purified Water (24 pk)', price: 7.99, discountPrice: 5.73, discountPercentage: 28, category: 'Best sellers', image: 'https://images.unsplash.com/photo-1548839140-29a7420a7088?w=400' },
    { name: 'Twix Caramel Chocolate Cookie Candy Bar', price: 1.98, discountPrice: 1.98, discountPercentage: 0, category: 'Best sellers', image: 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=400' },
    
    // Beverages
    { name: 'Coca-Cola Original Taste Soda (12 pk)', price: 8.99, discountPrice: 6.49, discountPercentage: 27, category: 'Beverages', image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400' },
    { name: 'Orange Juice 100% Pure (52 oz)', price: 5.43, discountPrice: 4.19, discountPercentage: 22, category: 'Beverages', image: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400' },
  ];

  for (const p of products) {
    await Product.create({
      ...p,
      vendor: safeway._id
    });
  }

  console.log('Seeding completed successfully!');
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
