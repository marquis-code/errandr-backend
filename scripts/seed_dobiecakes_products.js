const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;
console.log('Using MONGODB_URI:', MONGODB_URI);

const schemaOpts = { strict: false };
const ProductCategory = mongoose.model('ProductCategory', new mongoose.Schema({}, { ...schemaOpts, collection: 'productcategories' }));
const Product = mongoose.model('Product', new mongoose.Schema({}, { ...schemaOpts, collection: 'products' }));
const Vendor = mongoose.model('Vendor', new mongoose.Schema({}, { ...schemaOpts, collection: 'vendors' }));

const vendorId = '6a10589033746a05322633c7';
const ownerId = '6a10571f33746a05322633ba';

const categories = [
  { name: 'Layer Cakes', description: 'Stunning multi-layered cakes for beautiful celebrations.' },
  { name: 'Cheesecakes', description: 'Rich, creamy cheesecakes baked with premium cream cheese.' },
  { name: 'Cupcakes & Platters', description: 'Perfect assortments of bite-sized treats to share.' },
  { name: 'Bundt Cakes', description: 'Elegant ring-shaped cakes glazed and decorated with fresh fruit.' }
];

const products = [
  {
    name: 'Classic Red Velvet Cake',
    price: 15000,
    description: 'Luxurious red velvet sponge layered with our signature cream cheese frosting. Elegant, rich, and perfectly balanced.',
    image: 'https://images.unsplash.com/photo-1616541823729-00fe0aacd32c?w=600',
    category: 'Layer Cakes',
    isAvailable: true,
    isPreOrder: true,
    preOrderNote: 'Order at least 48 hours in advance.',
    tags: ['Best Seller', 'Red Velvet', 'Celebration']
  },
  {
    name: 'Madagascar Vanilla Bean Cake',
    price: 14000,
    description: 'Delicate vanilla bean cake layers, soaked in a light vanilla syrup and filled with premium Madagascar vanilla buttercream.',
    image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600',
    category: 'Layer Cakes',
    isAvailable: true,
    isPreOrder: true,
    preOrderNote: 'Order at least 48 hours in advance.',
    tags: ['Vanilla', 'Classic']
  },
  {
    name: 'Midnight Chocolate Fudge Cake',
    price: 16500,
    description: "Intense Belgian chocolate cake filled and frosted with a rich dark chocolate fudge. A chocolate lover's absolute dream.",
    image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600',
    category: 'Layer Cakes',
    isAvailable: true,
    isPreOrder: true,
    preOrderNote: 'Order at least 48 hours in advance.',
    tags: ['Chocolate', 'Rich', 'Fudge']
  },
  {
    name: 'Salted Caramel Pecan Cake',
    price: 18000,
    description: 'Fluffy brown sugar sponge layers, filled with homemade salted caramel sauce, toasted pecans, and caramel buttercream.',
    image: 'https://images.unsplash.com/photo-1535141192574-5d4897c13636?w=600',
    category: 'Layer Cakes',
    isAvailable: true,
    isPreOrder: true,
    preOrderNote: 'Order at least 48 hours in advance.',
    tags: ['Caramel', 'Pecan', 'Gourmet']
  },
  {
    name: 'Signature New York Cheesecake',
    price: 12000,
    description: 'Rich, dense, and incredibly smooth cream cheese filling on a buttery graham cracker crust. Topped with wild berry compote.',
    image: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=600',
    category: 'Cheesecakes',
    isAvailable: true,
    isPreOrder: true,
    preOrderNote: 'Order at least 48 hours in advance.',
    tags: ['Cheesecake', 'Berries', 'Classic']
  },
  {
    name: 'Mango Passionfruit Cheesecake',
    price: 13500,
    description: 'A tropical twist on our classic cheesecake. Silky smooth, layered with fresh mango purée and tangy passionfruit gel.',
    image: 'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=600',
    category: 'Cheesecakes',
    isAvailable: true,
    isPreOrder: true,
    preOrderNote: 'Order at least 48 hours in advance.',
    tags: ['Cheesecake', 'Mango', 'Tropical']
  },
  {
    name: 'Gourmet Cupcake Platter (Box of 12)',
    price: 7500,
    description: 'An assortment of 12 signature cupcakes: Red Velvet, Chocolate Fudge, Vanilla Bean, and Salted Caramel. Perfect for sharing.',
    image: 'https://images.unsplash.com/photo-1576618148400-f54bed99fcfd?w=600',
    category: 'Cupcakes & Platters',
    isAvailable: true,
    isPreOrder: true,
    preOrderNote: 'Order at least 24 hours in advance.',
    tags: ['Cupcakes', 'Party', 'Platter']
  },
  {
    name: 'Mini Cake Trio',
    price: 9000,
    description: 'Three individual mini 4-inch cakes in our most popular flavors: Red Velvet, Chocolate Fudge, and Vanilla Bean. Great for tastings!',
    image: 'https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?w=600',
    category: 'Cupcakes & Platters',
    isAvailable: true,
    isPreOrder: true,
    preOrderNote: 'Order at least 24 hours in advance.',
    tags: ['Mini Cake', 'Tasting']
  },
  {
    name: 'Spiced Carrot & Walnut Bundt Cake',
    price: 11000,
    description: 'Moist spiced carrot cake studded with toasted walnuts, baked in an elegant bundt shape and finished with a sweet cream cheese glaze drizzle.',
    image: 'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?w=600',
    category: 'Bundt Cakes',
    isAvailable: true,
    isPreOrder: true,
    preOrderNote: 'Order at least 48 hours in advance.',
    tags: ['Carrot', 'Walnuts', 'Bundt']
  },
  {
    name: 'Lemon Blueberry Glazed Bundt',
    price: 10500,
    description: 'Zesty, bright lemon sponge bursting with fresh blueberries, baked in a classic bundt mold and coated in a tangy lemon glaze.',
    image: 'https://images.unsplash.com/photo-1517433456452-f9633a875f6f?w=600',
    category: 'Bundt Cakes',
    isAvailable: true,
    isPreOrder: true,
    preOrderNote: 'Order at least 48 hours in advance.',
    tags: ['Lemon', 'Blueberry', 'Bundt']
  }
];

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB.');

    // 1. Verify DobiCakes exists
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      console.error('DobiCakes vendor record not found!');
      process.exit(1);
    }
    console.log('Found vendor:', vendor.storeName);

    // 2. Clear existing categories and products for this vendor
    const deletedProducts = await Product.deleteMany({ vendor: new mongoose.Types.ObjectId(vendorId) });
    console.log(`Deleted ${deletedProducts.deletedCount} old products`);

    const deletedCategories = await ProductCategory.deleteMany({ vendor: new mongoose.Types.ObjectId(vendorId) });
    console.log(`Deleted ${deletedCategories.deletedCount} old categories`);

    // 3. Seed new Categories
    console.log('\n--- SEEDING CATEGORIES ---');
    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i];
      const createdCat = await ProductCategory.create({
        vendor: new mongoose.Types.ObjectId(vendorId),
        name: cat.name,
        description: cat.description,
        image: products.find(p => p.category === cat.name)?.image || '',
        sortOrder: i,
        isActive: true
      });
      console.log(`Created Category: "${createdCat.name}" with ID: ${createdCat._id}`);
    }

    // 4. Seed new Products
    console.log('\n--- SEEDING PRODUCTS ---');
    for (const prod of products) {
      const createdProd = await Product.create({
        vendor: new mongoose.Types.ObjectId(vendorId),
        owner: new mongoose.Types.ObjectId(ownerId),
        name: prod.name,
        price: prod.price,
        description: prod.description,
        image: prod.image,
        category: prod.category,
        isAvailable: prod.isAvailable,
        isPreOrder: prod.isPreOrder,
        preOrderNote: prod.preOrderNote,
        tags: prod.tags,
        stockQuantity: -1,
        preparationTime: 45
      });
      console.log(`Created Product: "${createdProd.name}" under Category: "${createdProd.category}"`);
    }

    // 5. Update vendor tags and tags categories to match
    await Vendor.updateOne(
      { _id: new mongoose.Types.ObjectId(vendorId) },
      { $set: { tags: categories.map(c => c.name) } }
    );
    console.log('\nUpdated Vendor categories tags.');

    console.log('\n--- SEEDING COMPLETED SUCCESSFULLY ---');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
}

seed();
