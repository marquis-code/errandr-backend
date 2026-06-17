import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

// Simple Product Schema
const ProductSchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  discountPrice: Number,
  discountPercentage: Number,
  image: String,
  images: [String],
  category: { type: String, required: true },
  tags: [String],
  isAvailable: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  preparationTime: { type: Number, default: 0 },
  servingSize: String,
  portionInfo: String,
  calories: String,
  allergens: [String],
  stockQuantity: { type: Number, default: -1 },
  minOrderQty: { type: Number, default: 1 },
  maxOrderQty: { type: Number, default: 10 },
  customizations: { type: Array, default: [] },
  totalOrders: { type: Number, default: 0 },
  rating: { type: Number, default: 0 },
  isPreOrder: { type: Boolean, default: false },
}, { timestamps: true });

// Simple Vendor Schema
const VendorSchema = new mongoose.Schema({
  storeName: String,
  category: String,
}, { timestamps: true, strict: false });

const Product = mongoose.model('Product', ProductSchema);
const Vendor = mongoose.model('Vendor', VendorSchema);

const sampleProducts: Record<string, any[]> = {
  restaurant: [
    { name: 'Jollof Rice & Chicken', price: 2500, description: 'Spicy Nigerian jollof rice with grilled chicken.' },
    { name: 'Fried Rice & Beef', price: 2800, description: 'Delicious fried rice with tender beef chunks.' },
    { name: 'Pounded Yam & Egusi', price: 3500, description: 'Traditional pounded yam with rich egusi soup.' }
  ],
  snacks: [
    { name: 'Meat Pie', price: 500, description: 'Freshly baked meat pie.' },
    { name: 'Sausage Roll', price: 400, description: 'Tasty sausage roll.' },
    { name: 'Chicken Pie', price: 600, description: 'Freshly baked chicken pie.' }
  ],
  drinks: [
    { name: 'Coca-Cola 50cl', price: 300, description: 'Chilled bottle of Coca-Cola.' },
    { name: 'Fresh Orange Juice', price: 1500, description: 'Freshly squeezed orange juice.' },
    { name: 'Bottled Water', price: 200, description: 'Chilled table water.' }
  ],
  groceries: [
    { name: 'Milk 1L', price: 1500, description: 'Full cream milk.' },
    { name: 'Bread', price: 800, description: 'Sliced family loaf.' },
    { name: 'Eggs (1 Crate)', price: 2500, description: 'Fresh farm eggs.' }
  ],
  hair_salon: [
    { name: 'Braids', price: 5000, description: 'Knotless braids.' },
    { name: 'Weavon Fixing', price: 3000, description: 'Professional weavon fixing.' },
    { name: 'Wig Revamp', price: 2000, description: 'Wig washing and styling.' }
  ],
  nails: [
    { name: 'Acrylic Nails', price: 4000, description: 'Full set acrylic nails.' },
    { name: 'Gel Polish', price: 2000, description: 'Gel polish application.' },
    { name: 'Pedicure', price: 3500, description: 'Deep cleaning pedicure.' }
  ],
  barber: [
    { name: 'Haircut', price: 1500, description: 'Professional men haircut.' },
    { name: 'Hair Dye', price: 2000, description: 'Hair tinting and dyeing.' },
    { name: 'Beard Trimming', price: 1000, description: 'Clean beard shaping.' }
  ]
};

async function seedProducts() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI not set');
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const vendors = await Vendor.find({});
  console.log(`Found ${vendors.length} vendors`);

  let count = 0;

  for (const vendor of vendors) {
    let categoryKey = (vendor.category || 'restaurant') as string;
    if (!sampleProducts[categoryKey]) {
      categoryKey = 'restaurant'; // Fallback
    }

    const itemsToCreate = sampleProducts[categoryKey] || sampleProducts['restaurant'];
    
    // Check if products already exist for this vendor to avoid duplicates
    const existingCount = await Product.countDocuments({ vendor: vendor._id });
    if (existingCount === 0) {
      for (const item of itemsToCreate) {
        await Product.create({
          vendor: vendor._id,
          name: item.name,
          description: item.description,
          price: item.price,
          category: vendor.category || 'general',
          image: 'https://via.placeholder.com/300x200?text=' + encodeURIComponent(item.name),
        });
        count++;
      }
      console.log(`Seeded products for vendor ${vendor.storeName} (${vendor.category})`);
    } else {
      console.log(`Vendor ${vendor.storeName} already has ${existingCount} products.`);
    }
  }

  console.log(`Done. Seeded ${count} new products.`);
  await mongoose.disconnect();
}

seedProducts().catch(err => {
  console.error(err);
  process.exit(1);
});
