/**
 * migrate-products-to-menu-items.js
 *
 * Idempotent migration: converts existing Product documents belonging to food
 * vendors into MenuItem documents (Chowdeck-style).
 *
 * Food vendor categories: restaurant, eatery, snacks, drinks, bakery
 * (groceries are explicitly excluded — they stay on the Product model)
 *
 * Usage:
 *   node scripts/migrate-products-to-menu-items.js
 *   node scripts/migrate-products-to-menu-items.js --dry-run   (preview only)
 *
 * Behavior:
 * - Skips any Product whose vendor is NOT a food vendor
 * - Skips any Product that already has a corresponding MenuItem (matched by
 *   vendor + name, making re-runs safe)
 * - Maps Product.customizations → standalone Modifier documents
 * - Logs unmappable fields (e.g. missing price) to a report
 * - Creates MenuCategory documents per-vendor from Product.category strings
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI?.replace(/^"|"$/g, '') ||
  'mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr';

const FOOD_CATEGORIES = ['restaurant', 'eatery', 'snacks', 'drinks', 'bakery'];
const DRY_RUN = process.argv.includes('--dry-run');

// ── Minimal Mongoose Schemas ──

const VendorSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  storeName: String,
  category: String,
}, { collection: 'vendors' });

const ProductSchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
  name: String,
  description: String,
  price: Number,
  discountPrice: Number,
  image: String,
  images: [String],
  category: String,
  tags: [String],
  isAvailable: Boolean,
  isFeatured: Boolean,
  preparationTime: Number,
  servingSize: String,
  portionInfo: String,
  calories: String,
  allergens: [String],
  stockQuantity: Number,
  minOrderQty: Number,
  maxOrderQty: Number,
  customizations: [{
    name: String,
    options: [{ label: String, price: Number }],
  }],
  totalOrders: Number,
  rating: Number,
  isPreOrder: Boolean,
}, { collection: 'products', timestamps: true });

const MenuCategorySchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
  name: String,
  image: String,
  sortOrder: Number,
  isActive: Boolean,
}, { collection: 'menucategories', timestamps: true });

const ModifierSchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
  name: String,
  optionGroup: String,
  items: [{ name: String, price: Number }],
  maxSelection: Number,
  publishNow: Boolean,
}, { collection: 'modifiers', timestamps: true });

const MenuItemSchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
  name: String,
  description: String,
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuCategory' },
  trackStock: Boolean,
  inStock: Number,
  costPrice: Number,
  price: Number,
  sku: String,
  variations: [{ name: String, costPrice: Number, price: Number, sku: String, stock: Number }],
  modifiers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Modifier' }],
  addOns: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AddOn' }],
  packs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MenuPack' }],
  tags: [String],
  maxQuantity: Number,
  maxQuantityAsSide: Number,
  volumePerPortion: Number,
  volumeUnit: String,
  imageUrl: String,
  publishItem: Boolean,
}, { collection: 'menuitems', timestamps: true });

async function run() {
  console.log(`\n🚀 Migration: Product → MenuItem (Chowdeck-style)`);
  console.log(`   Mode: ${DRY_RUN ? '🔍 DRY RUN (no writes)' : '✏️  LIVE'}`);
  console.log(`   Food categories: ${FOOD_CATEGORIES.join(', ')}\n`);

  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const Vendor = mongoose.model('Vendor', VendorSchema);
  const Product = mongoose.model('Product', ProductSchema);
  const MenuCategoryModel = mongoose.model('MenuCategory', MenuCategorySchema);
  const ModifierModel = mongoose.model('Modifier', ModifierSchema);
  const MenuItemModel = mongoose.model('MenuItem', MenuItemSchema);

  // Step 1: Find all food vendors
  const foodVendors = await Vendor.find({ category: { $in: FOOD_CATEGORIES } }).lean();
  console.log(`📋 Found ${foodVendors.length} food vendor(s)\n`);

  if (foodVendors.length === 0) {
    console.log('Nothing to migrate. Exiting.');
    await mongoose.disconnect();
    return;
  }

  const foodVendorIds = foodVendors.map(v => v._id);
  const vendorMap = new Map(foodVendors.map(v => [v._id.toString(), v]));

  // Step 2: Find all products belonging to food vendors
  const products = await Product.find({ vendor: { $in: foodVendorIds } }).lean();
  console.log(`📦 Found ${products.length} product(s) to migrate\n`);

  const report = {
    migrated: 0,
    skipped: 0,
    categoriesCreated: 0,
    modifiersCreated: 0,
    warnings: [],
  };

  // Cache for categories and modifiers per vendor to avoid duplicates
  const categoryCache = new Map(); // "vendorId:categoryName" → ObjectId
  const modifierCache = new Map(); // "vendorId:modifierName" → ObjectId

  // Pre-load existing menu items to check for duplicates
  const existingMenuItems = await MenuItemModel.find({
    vendor: { $in: foodVendorIds },
  }).select('vendor name').lean();
  const existingSet = new Set(
    existingMenuItems.map(mi => `${mi.vendor.toString()}:${mi.name}`),
  );

  // Pre-load existing menu categories
  const existingCategories = await MenuCategoryModel.find({
    vendor: { $in: foodVendorIds },
  }).lean();
  for (const cat of existingCategories) {
    categoryCache.set(`${cat.vendor.toString()}:${cat.name}`, cat._id);
  }

  // Pre-load existing modifiers
  const existingModifiers = await ModifierModel.find({
    vendor: { $in: foodVendorIds },
  }).lean();
  for (const mod of existingModifiers) {
    modifierCache.set(`${mod.vendor.toString()}:${mod.name}`, mod._id);
  }

  for (const product of products) {
    const vendorId = product.vendor.toString();
    const key = `${vendorId}:${product.name}`;

    // Idempotency check
    if (existingSet.has(key)) {
      console.log(`  ⏭️  Skip (already exists): "${product.name}" [vendor: ${vendorMap.get(vendorId)?.storeName}]`);
      report.skipped++;
      continue;
    }

    // Warn if no price
    if (product.price == null || product.price < 0) {
      report.warnings.push(`Product "${product.name}" (${product._id}) has no valid price — defaulting to 0`);
    }

    // Step 3a: Create/resolve MenuCategory from product.category string
    let categoryId = null;
    if (product.category && product.category.trim()) {
      const catKey = `${vendorId}:${product.category}`;
      if (categoryCache.has(catKey)) {
        categoryId = categoryCache.get(catKey);
      } else if (!DRY_RUN) {
        const newCat = await MenuCategoryModel.create({
          vendor: product.vendor,
          name: product.category,
          isActive: true,
          sortOrder: 0,
        });
        categoryId = newCat._id;
        categoryCache.set(catKey, categoryId);
        report.categoriesCreated++;
        console.log(`  📁 Created category: "${product.category}" for ${vendorMap.get(vendorId)?.storeName}`);
      } else {
        report.categoriesCreated++;
        console.log(`  📁 [DRY] Would create category: "${product.category}" for ${vendorMap.get(vendorId)?.storeName}`);
      }
    }

    // Step 3b: Convert product.customizations → Modifier documents
    const modifierIds = [];
    if (product.customizations && product.customizations.length > 0) {
      for (const cust of product.customizations) {
        if (!cust.name || !cust.options?.length) continue;
        const modKey = `${vendorId}:${cust.name}`;
        if (modifierCache.has(modKey)) {
          modifierIds.push(modifierCache.get(modKey));
        } else if (!DRY_RUN) {
          const newMod = await ModifierModel.create({
            vendor: product.vendor,
            name: cust.name,
            items: cust.options.map(opt => ({
              name: opt.label || opt.name,
              price: opt.price || 0,
            })),
            maxSelection: cust.options.length,
            publishNow: true,
          });
          modifierIds.push(newMod._id);
          modifierCache.set(modKey, newMod._id);
          report.modifiersCreated++;
          console.log(`  🔧 Created modifier: "${cust.name}" for ${vendorMap.get(vendorId)?.storeName}`);
        } else {
          report.modifiersCreated++;
          console.log(`  🔧 [DRY] Would create modifier: "${cust.name}" for ${vendorMap.get(vendorId)?.storeName}`);
        }
      }
    }

    // Step 3c: Build the MenuItem document
    const menuItemData = {
      vendor: product.vendor,
      name: product.name,
      description: product.description || '',
      category: categoryId,
      trackStock: product.stockQuantity != null && product.stockQuantity >= 0,
      inStock: product.stockQuantity != null && product.stockQuantity >= 0
        ? product.stockQuantity
        : 0,
      costPrice: product.price || 0, // No costPrice on Product — default to price
      price: product.price || 0,
      sku: '',
      variations: [],
      modifiers: modifierIds,
      addOns: [],
      packs: [],
      tags: product.tags || [],
      maxQuantity: product.maxOrderQty || undefined,
      volumeUnit: 'kg',
      imageUrl: product.image || '',
      publishItem: product.isAvailable !== false, // Preserve current visibility
    };

    if (!DRY_RUN) {
      await MenuItemModel.create(menuItemData);
      existingSet.add(key); // Prevent re-processing on same run
    }

    console.log(`  ✅ ${DRY_RUN ? '[DRY] Would migrate' : 'Migrated'}: "${product.name}" → MenuItem [vendor: ${vendorMap.get(vendorId)?.storeName}]`);
    report.migrated++;
  }

  // ── Report ──
  console.log('\n' + '═'.repeat(60));
  console.log('  MIGRATION REPORT');
  console.log('═'.repeat(60));
  console.log(`  Items migrated:     ${report.migrated}`);
  console.log(`  Items skipped:      ${report.skipped} (already existed)`);
  console.log(`  Categories created: ${report.categoriesCreated}`);
  console.log(`  Modifiers created:  ${report.modifiersCreated}`);
  if (report.warnings.length > 0) {
    console.log(`\n  ⚠️  Warnings (${report.warnings.length}):`);
    report.warnings.forEach(w => console.log(`     - ${w}`));
  }
  console.log('═'.repeat(60));

  await mongoose.disconnect();
  console.log('\n🔌 Disconnected from MongoDB\n');
}

run().catch(err => {
  console.error('❌ Migration failed:', err);
  mongoose.disconnect();
  process.exit(1);
});
