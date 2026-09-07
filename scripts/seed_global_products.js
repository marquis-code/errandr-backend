const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load env vars
dotenv.config({ path: __dirname + '/../.env' });

const MONGO_URI = process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error("MONGODB_URI is not set in .env file.");
  process.exit(1);
}

const globalProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  image: String,
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductCategory' },
  source: { type: String, enum: ['manual', 'promoted'], default: 'manual' },
  vendorAdoptionCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const GlobalProduct = mongoose.models.GlobalProduct || mongoose.model('GlobalProduct', globalProductSchema);

const seedItems = [
  // Noodles & Pasta
  { name: 'Indomie Chicken Flavor 70g', category: 'Noodles' },
  { name: 'Indomie Onion Chicken Flavor 70g', category: 'Noodles' },
  { name: 'Indomie Hungry Man Size 200g', category: 'Noodles' },
  { name: 'Indomie Bellefull 280g', category: 'Noodles' },
  { name: 'Minimie Chinchin', category: 'Snacks' },
  { name: 'Golden Penny Spaghetti 500g', category: 'Pasta' },
  { name: 'Dangote Spaghetti 500g', category: 'Pasta' },
  // Drinks (Sachets & Bottles)
  { name: 'Coca-Cola 50cl', category: 'Drinks' },
  { name: 'Sprite 50cl', category: 'Drinks' },
  { name: 'Fanta 50cl', category: 'Drinks' },
  { name: 'Pepsi 50cl', category: 'Drinks' },
  { name: '7Up 50cl', category: 'Drinks' },
  { name: 'Mirinda 50cl', category: 'Drinks' },
  { name: 'Monster Energy Drink 440ml', category: 'Drinks' },
  { name: 'Fearless Energy Drink 500ml', category: 'Drinks' },
  { name: 'Predator Energy Drink', category: 'Drinks' },
  { name: 'Hollandia Yoghurt 315ml', category: 'Drinks' },
  { name: 'Chivita Active 315ml', category: 'Drinks' },
  { name: 'Ribena 150ml', category: 'Drinks' },
  { name: 'Capri-Sun 200ml', category: 'Drinks' },
  { name: 'Viju Milk 330ml', category: 'Drinks' },
  { name: 'Eva Water 75cl', category: 'Water' },
  { name: 'Aquafina Water 75cl', category: 'Water' },
  { name: 'Nestle Pure Life Water 60cl', category: 'Water' },
  { name: 'Sachet Water (Bag)', category: 'Water' },
  // Snacks & Biscuits
  { name: 'Plantain Chips', category: 'Snacks' },
  { name: 'Potato Chips', category: 'Snacks' },
  { name: 'Gala Sausage Roll', category: 'Snacks' },
  { name: 'Rite Sausage Roll', category: 'Snacks' },
  { name: 'Superbite Sausage Roll', category: 'Snacks' },
  { name: 'Pure Bliss Biscuit', category: 'Snacks' },
  { name: 'Digestive Biscuit', category: 'Snacks' },
  { name: 'Speedy Biscuit', category: 'Snacks' },
  { name: 'Coaster Biscuit', category: 'Snacks' },
  { name: 'Fish Bone Biscuit', category: 'Snacks' },
  { name: 'Oreo Biscuit 119.6g', category: 'Snacks' },
  { name: 'Cheeseballs', category: 'Snacks' },
  { name: 'Popcorn', category: 'Snacks' },
  { name: 'Pringles Original 165g', category: 'Snacks' },
  { name: 'Maltina 33cl', category: 'Drinks' },
  { name: 'Malta Guinness 33cl', category: 'Drinks' },
  { name: 'Amstel Malta 33cl', category: 'Drinks' },
  // Provisions
  { name: 'Milo Sachet 20g', category: 'Provisions' },
  { name: 'Bournvita Sachet 20g', category: 'Provisions' },
  { name: 'Ovaltine Sachet 20g', category: 'Provisions' },
  { name: 'Peak Milk Sachet 14g', category: 'Provisions' },
  { name: 'Cowbell Milk Sachet 14g', category: 'Provisions' },
  { name: 'Dano Milk Sachet 14g', category: 'Provisions' },
  { name: 'Three Crowns Milk Sachet', category: 'Provisions' },
  { name: 'Lipton Yellow Label Tea (25 bags)', category: 'Provisions' },
  { name: 'Top Tea (25 bags)', category: 'Provisions' },
  { name: 'Nescafé Classic Sachet 2g', category: 'Provisions' },
  { name: 'St. Louis Sugar 500g', category: 'Provisions' },
  { name: 'Dangote Sugar 500g', category: 'Provisions' },
  { name: 'Golden Penny Sugar', category: 'Provisions' },
  { name: 'Cornflakes (Kelloggs) Sachet', category: 'Provisions' },
  { name: 'Infinity Cornflakes Sachet', category: 'Provisions' },
  { name: 'Golden Morn Sachet 45g', category: 'Provisions' },
  { name: 'Checkers Custard Sachet', category: 'Provisions' },
  { name: 'Quaker Oats 500g', category: 'Provisions' },
  { name: 'Bama Mayonnaise 473ml', category: 'Provisions' },
  { name: 'Jago Mayonnaise', category: 'Provisions' },
  { name: 'Blue Band Margarine 250g', category: 'Provisions' },
  // Toiletries
  { name: 'Dettol Soap 65g', category: 'Toiletries' },
  { name: 'Tetmosol Soap', category: 'Toiletries' },
  { name: 'Premier Soap', category: 'Toiletries' },
  { name: 'Joy Soap', category: 'Toiletries' },
  { name: 'Lux Soap', category: 'Toiletries' },
  { name: 'Irish Spring Soap', category: 'Toiletries' },
  { name: 'CloseUp Toothpaste 140g', category: 'Toiletries' },
  { name: 'Macleans Toothpaste', category: 'Toiletries' },
  { name: 'Oral-B Toothpaste', category: 'Toiletries' },
  { name: 'Pepsodent Toothpaste', category: 'Toiletries' },
  { name: 'Toothbrush (Adult)', category: 'Toiletries' },
  { name: 'Toilet Roll (Single)', category: 'Toiletries' },
  { name: 'Ariel Detergent Sachet', category: 'Toiletries' },
  { name: 'Omo Detergent Sachet', category: 'Toiletries' },
  { name: 'Klin Detergent Sachet', category: 'Toiletries' },
  { name: 'Sunlight Detergent Sachet', category: 'Toiletries' },
  { name: 'Viva Detergent Sachet', category: 'Toiletries' },
  { name: 'Morning Fresh Liquid Soap Sachet', category: 'Toiletries' },
  { name: 'Always Ultra Sanitary Pad', category: 'Toiletries' },
  { name: 'Ladycare Sanitary Pad', category: 'Toiletries' },
  { name: 'Roll-on Deodorant (Nivea)', category: 'Toiletries' },
  { name: 'Body Spray (Smart Collection)', category: 'Toiletries' },
  { name: 'Gillette Shaving Stick', category: 'Toiletries' },
  { name: 'Cotton Buds', category: 'Toiletries' },
  // Basic Drugs
  { name: 'Panadol Extra', category: 'Pharmacy' },
  { name: 'Paracetamol', category: 'Pharmacy' },
  { name: 'Ibuprofen', category: 'Pharmacy' },
  { name: 'Andrews Liver Salts', category: 'Pharmacy' },
  { name: 'Gestid Suspension', category: 'Pharmacy' },
  { name: 'Vitamin C', category: 'Pharmacy' },
  { name: 'Plaster (Elastoplast)', category: 'Pharmacy' },
  // Stationery
  { name: 'Biro (Bic - Blue)', category: 'Stationery' },
  { name: 'Biro (Bic - Black)', category: 'Stationery' },
  { name: 'Biro (Bic - Red)', category: 'Stationery' },
  { name: 'Pencil', category: 'Stationery' },
  { name: 'Eraser', category: 'Stationery' },
  { name: 'Sharpener', category: 'Stationery' },
  { name: 'Higher Education Notebook (40 Leaves)', category: 'Stationery' },
  { name: 'Higher Education Notebook (60 Leaves)', category: 'Stationery' },
  { name: 'A4 Paper (Ream)', category: 'Stationery' },
  { name: 'Tipp-Ex (Correction Fluid)', category: 'Stationery' },
  { name: 'Sticky Notes', category: 'Stationery' },
  { name: 'Stapler', category: 'Stationery' },
  { name: 'Staple Pins', category: 'Stationery' },
  // Miscellaneous
  { name: 'Matches (Box)', category: 'Miscellaneous' },
  { name: 'Candle', category: 'Miscellaneous' },
  { name: 'Batteries (AA)', category: 'Miscellaneous' },
  { name: 'Batteries (AAA)', category: 'Miscellaneous' },
  { name: 'Recharge Card (MTN 100)', category: 'Miscellaneous' },
  { name: 'Recharge Card (Airtel 100)', category: 'Miscellaneous' },
  { name: 'Recharge Card (Glo 100)', category: 'Miscellaneous' },
  { name: 'Recharge Card (9mobile 100)', category: 'Miscellaneous' },
];

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB.");

    console.log(`Seeding ${seedItems.length} global products...`);
    
    let added = 0;
    for (const item of seedItems) {
      // Check if already exists
      const exists = await GlobalProduct.findOne({ name: item.name });
      if (!exists) {
        await GlobalProduct.create({
          name: item.name,
          source: 'manual', // Setting manual as default for now, can be 'promoted' later if we partner with brands
        });
        added++;
      }
    }
    
    console.log(`Successfully added ${added} new global products.`);
    process.exit(0);
  } catch (error) {
    console.error("Failed to seed global products:", error);
    process.exit(1);
  }
}

seed();
