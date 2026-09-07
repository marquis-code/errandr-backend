/**
 * seed-chowdeck-menu.js
 *
 * Creates a food vendor (restaurant) with a robust Chowdeck-style menu:
 *   - 8 MenuCategories
 *   - 10 Modifiers (mandatory customizations)
 *   - 8 Add-ons (optional extras)
 *   - 5 MenuPacks (packaging options)
 *   - 35+ MenuItems with variations, modifier/add-on/pack refs
 *
 * Idempotent — safe to re-run. Skips if vendor already exists.
 *
 * Usage:
 *   node scripts/seed-chowdeck-menu.js
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const MONGODB_URI =
  (process.env.MONGODB_URI || '').replace(/^"|"$/g, '') ||
  'mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr';

// ── Schemas (lightweight for script) ──

const UserSchema = new mongoose.Schema(
  {
    firstName: String,
    lastName: String,
    email: { type: String, unique: true },
    password: String,
    role: { type: String, default: 'student' },
    isVerified: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const VendorSchema = new mongoose.Schema(
  {
    owner: mongoose.Schema.Types.ObjectId,
    storeName: String,
    subdomain: String,
    description: String,
    logo: String,
    banner: String,
    category: String,
    tags: [String],
    phone: String,
    address: String,
    businessType: { type: String, default: 'physical_product' },
    isInsideCampus: Boolean,
    location: {
      type: { type: String, default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] },
    },
    status: { type: String, default: 'approved' },
    isOnline: { type: Boolean, default: true },
    businessHours: [
      {
        day: String,
        open: String,
        close: String,
        isClosed: Boolean,
      },
    ],
    rating: Number,
    totalOrders: Number,
    preparationTime: Number,
    deliveryFee: Number,
    baseDeliveryFee: Number,
    packs: [{ name: String, price: Number, isActive: Boolean }],
    packagingFee: Number,
    minimumOrder: Number,
  },
  { timestamps: true },
);

const MenuCategorySchema = new mongoose.Schema(
  {
    vendor: mongoose.Schema.Types.ObjectId,
    name: String,
    image: String,
    sortOrder: Number,
    isActive: { type: Boolean, default: true },
  },
  { collection: 'menucategories', timestamps: true },
);

const ModifierSchema = new mongoose.Schema(
  {
    vendor: mongoose.Schema.Types.ObjectId,
    name: String,
    optionGroup: String,
    items: [{ name: String, price: Number }],
    maxSelection: Number,
    publishNow: { type: Boolean, default: true },
  },
  { collection: 'modifiers', timestamps: true },
);

const AddOnSchema = new mongoose.Schema(
  {
    vendor: mongoose.Schema.Types.ObjectId,
    name: String,
    items: [{ name: String, price: Number }],
    minSelection: Number,
    maxSelection: Number,
    publishNow: { type: Boolean, default: true },
  },
  { collection: 'addons', timestamps: true },
);

const MenuPackSchema = new mongoose.Schema(
  {
    vendor: mongoose.Schema.Types.ObjectId,
    name: String,
    description: String,
    price: Number,
    maxVolume: Number,
  },
  { collection: 'menupacks', timestamps: true },
);

const MenuItemSchema = new mongoose.Schema(
  {
    vendor: mongoose.Schema.Types.ObjectId,
    name: String,
    description: String,
    category: mongoose.Schema.Types.ObjectId,
    trackStock: Boolean,
    inStock: Number,
    costPrice: Number,
    price: Number,
    sku: String,
    variations: [
      {
        name: String,
        costPrice: Number,
        price: Number,
        sku: String,
        stock: Number,
      },
    ],
    modifiers: [mongoose.Schema.Types.ObjectId],
    addOns: [mongoose.Schema.Types.ObjectId],
    packs: [mongoose.Schema.Types.ObjectId],
    tags: [String],
    maxQuantity: Number,
    maxQuantityAsSide: Number,
    volumePerPortion: Number,
    volumeUnit: String,
    imageUrl: String,
    publishItem: { type: Boolean, default: true },
  },
  { collection: 'menuitems', timestamps: true },
);

// ═══════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════

const VENDOR_INFO = {
  firstName: 'Chef',
  lastName: 'Adewale',
  email: 'chef.adewale@erranders.org',
  password: 'Erranders2026!',
  storeName: "Adewale's Kitchen",
  subdomain: 'adewales-kitchen',
  description:
    'Premium Nigerian cuisine — from smoky party-style jollof to signature suya platters. Fresh ingredients, bold flavours, delivered fast.',
  category: 'restaurant',
  phone: '+2348012345678',
  address: 'Block A, Food Court, University Campus',
  tags: ['nigerian', 'jollof', 'suya', 'party-food', 'grills', 'local', 'campus-fav'],
};

const CATEGORIES = [
  { name: 'Rice Dishes', sortOrder: 1 },
  { name: 'Swallow & Soups', sortOrder: 2 },
  { name: 'Grills & Protein', sortOrder: 3 },
  { name: 'Pasta & Noodles', sortOrder: 4 },
  { name: 'Sides & Extras', sortOrder: 5 },
  { name: 'Drinks', sortOrder: 6 },
  { name: 'Shawarma & Wraps', sortOrder: 7 },
  { name: 'Desserts & Snacks', sortOrder: 8 },
];

const MODIFIERS = [
  {
    name: 'Choose your protein',
    optionGroup: 'protein',
    items: [
      { name: 'Grilled Chicken', price: 1500 },
      { name: 'Beef Suya Strips', price: 1800 },
      { name: 'Turkey', price: 2500 },
      { name: 'Goat Meat', price: 2000 },
      { name: 'Fish (Tilapia)', price: 2200 },
    ],
    maxSelection: 1,
  },
  {
    name: 'Choose your swallow',
    optionGroup: 'swallow',
    items: [
      { name: 'Eba (Garri)', price: 0 },
      { name: 'Pounded Yam', price: 200 },
      { name: 'Semovita', price: 100 },
      { name: 'Amala', price: 0 },
      { name: 'Fufu', price: 0 },
    ],
    maxSelection: 1,
  },
  {
    name: 'Choose your soup',
    optionGroup: 'soup',
    items: [
      { name: 'Egusi Soup', price: 0 },
      { name: 'Efo Riro', price: 0 },
      { name: 'Ogbono Soup', price: 0 },
      { name: 'Banga Soup', price: 200 },
      { name: 'Oha Soup', price: 200 },
      { name: 'Ewedu + Gbegiri', price: 0 },
    ],
    maxSelection: 1,
  },
  {
    name: 'Spice level',
    optionGroup: 'spice',
    items: [
      { name: 'Mild', price: 0 },
      { name: 'Medium', price: 0 },
      { name: 'Hot 🔥', price: 0 },
      { name: 'Extra Hot 🔥🔥', price: 100 },
    ],
    maxSelection: 1,
  },
  {
    name: 'Choose your rice',
    optionGroup: 'rice-type',
    items: [
      { name: 'Jollof Rice', price: 0 },
      { name: 'Fried Rice', price: 0 },
      { name: 'White Rice', price: 0 },
      { name: 'Coconut Rice', price: 200 },
      { name: 'Native Jollof', price: 300 },
    ],
    maxSelection: 1,
  },
  {
    name: 'Choose your pasta',
    optionGroup: 'pasta-type',
    items: [
      { name: 'Spaghetti', price: 0 },
      { name: 'Penne', price: 0 },
      { name: 'Macaroni', price: 0 },
    ],
    maxSelection: 1,
  },
  {
    name: 'Choose your sauce',
    optionGroup: 'sauce',
    items: [
      { name: 'Jollof Sauce', price: 0 },
      { name: 'Stir-fry Sauce', price: 0 },
      { name: 'Creamy White Sauce', price: 200 },
      { name: 'Bolognese', price: 300 },
    ],
    maxSelection: 1,
  },
  {
    name: 'Choose wrap type',
    optionGroup: 'wrap',
    items: [
      { name: 'Tortilla Wrap', price: 0 },
      { name: 'Shawarma Bread', price: 0 },
      { name: 'Pita Bread', price: 100 },
    ],
    maxSelection: 1,
  },
  {
    name: 'Choose your drink size',
    optionGroup: 'drink-size',
    items: [
      { name: 'Small (35cl)', price: 0 },
      { name: 'Medium (50cl)', price: 200 },
      { name: 'Large (1L)', price: 500 },
    ],
    maxSelection: 1,
  },
  {
    name: 'Extra protein (pick up to 2)',
    optionGroup: 'extra-protein',
    items: [
      { name: 'Extra Chicken', price: 1500 },
      { name: 'Extra Beef', price: 1200 },
      { name: 'Extra Turkey', price: 2000 },
      { name: 'Extra Fish', price: 1800 },
      { name: 'Extra Egg', price: 400 },
    ],
    maxSelection: 2,
  },
];

const ADDONS = [
  {
    name: 'Extra toppings',
    items: [
      { name: 'Fried Plantain', price: 300 },
      { name: 'Coleslaw', price: 200 },
      { name: 'Moi Moi', price: 400 },
      { name: 'Extra Stew', price: 200 },
    ],
    minSelection: 0,
    maxSelection: 4,
  },
  {
    name: 'Sauces & Dips',
    items: [
      { name: 'Ketchup', price: 100 },
      { name: 'Mayonnaise', price: 100 },
      { name: 'Chilli Sauce', price: 150 },
      { name: 'Suya Pepper Dip', price: 200 },
    ],
    minSelection: 0,
    maxSelection: 3,
  },
  {
    name: 'Salad extras',
    items: [
      { name: 'Garden Salad', price: 500 },
      { name: 'Caesar Salad', price: 700 },
      { name: 'Coleslaw Side', price: 300 },
    ],
    minSelection: 0,
    maxSelection: 2,
  },
  {
    name: 'Drink add-ons',
    items: [
      { name: 'Ice', price: 0 },
      { name: 'Extra Sugar', price: 0 },
      { name: 'Lemon Slice', price: 100 },
      { name: 'Mint Leaves', price: 100 },
    ],
    minSelection: 0,
    maxSelection: 4,
  },
  {
    name: 'Bread sides',
    items: [
      { name: 'Garlic Bread (2pcs)', price: 500 },
      { name: 'Toast Bread', price: 300 },
      { name: 'Agege Bread Slice', price: 200 },
    ],
    minSelection: 0,
    maxSelection: 2,
  },
  {
    name: 'Soup boosters',
    items: [
      { name: 'Extra Meat in Soup', price: 500 },
      { name: 'Extra Fish in Soup', price: 600 },
      { name: 'Kpomo (Ponmo)', price: 400 },
      { name: 'Snail', price: 800 },
      { name: 'Shaki (Tripe)', price: 500 },
    ],
    minSelection: 0,
    maxSelection: 3,
  },
  {
    name: 'Shawarma extras',
    items: [
      { name: 'Extra Sausage', price: 400 },
      { name: 'Extra Cheese', price: 300 },
      { name: 'Jalapeños', price: 200 },
      { name: 'Coleslaw Filling', price: 200 },
    ],
    minSelection: 0,
    maxSelection: 4,
  },
  {
    name: 'Dessert toppings',
    items: [
      { name: 'Whipped Cream', price: 200 },
      { name: 'Chocolate Sauce', price: 250 },
      { name: 'Caramel Drizzle', price: 250 },
      { name: 'Sprinkles', price: 100 },
    ],
    minSelection: 0,
    maxSelection: 3,
  },
];

const PACKS = [
  { name: 'Standard Pack', description: 'Single portion takeaway', price: 200, maxVolume: 500 },
  { name: 'Medium Pack', description: '2-plate meals', price: 350, maxVolume: 750 },
  { name: 'Large Pack', description: 'Family-sized container', price: 500, maxVolume: 1500 },
  { name: 'Bowl Pack', description: 'Round bowl for soups/stews', price: 300, maxVolume: 600 },
  { name: 'Premium Box', description: 'Insulated box, keeps food hot', price: 700, maxVolume: 1000 },
];

// Menu Items — references modifiers/addons/packs by NAME (resolved to ObjectIds below)
const MENU_ITEMS = [
  // ── Rice Dishes ──
  {
    name: 'Jollof Rice Combo',
    description: 'Smoky party-style jollof rice with your choice of protein. Comes with fried plantain.',
    categoryName: 'Rice Dishes',
    costPrice: 1200, price: 2500,
    modifierNames: ['Choose your protein', 'Spice level'],
    addOnNames: ['Extra toppings', 'Sauces & Dips'],
    packNames: ['Standard Pack', 'Medium Pack'],
    tags: ['jollof', 'rice', 'party-food', 'nigerian', 'bestseller'],
    maxQuantity: 15, volumePerPortion: 0.5, volumeUnit: 'kg',
    variations: [
      { name: 'Regular', costPrice: 1200, price: 2500, sku: 'JOL-REG', stock: 200 },
      { name: 'Large', costPrice: 1800, price: 3500, sku: 'JOL-LRG', stock: 100 },
    ],
  },
  {
    name: 'Fried Rice Special',
    description: 'Chinese-style fried rice loaded with vegetables and your choice of protein.',
    categoryName: 'Rice Dishes',
    costPrice: 1300, price: 2700,
    modifierNames: ['Choose your protein', 'Spice level'],
    addOnNames: ['Extra toppings', 'Salad extras'],
    packNames: ['Standard Pack', 'Medium Pack'],
    tags: ['fried-rice', 'rice', 'chinese-style', 'nigerian'],
    maxQuantity: 15, volumePerPortion: 0.5, volumeUnit: 'kg',
    variations: [
      { name: 'Regular', costPrice: 1300, price: 2700, sku: 'FRI-REG', stock: 150 },
      { name: 'Large', costPrice: 1900, price: 3800, sku: 'FRI-LRG', stock: 80 },
    ],
  },
  {
    name: 'Coconut Rice',
    description: 'Sweet & savoury coconut rice cooked with fresh coconut milk.',
    categoryName: 'Rice Dishes',
    costPrice: 1400, price: 2800,
    modifierNames: ['Choose your protein'],
    addOnNames: ['Extra toppings'],
    packNames: ['Standard Pack', 'Medium Pack'],
    tags: ['coconut', 'rice', 'nigerian', 'sweet'],
    maxQuantity: 10, volumePerPortion: 0.5, volumeUnit: 'kg',
    variations: [],
  },
  {
    name: 'Rice & Stew Combo',
    description: 'Plain white rice with rich tomato stew and assorted proteins.',
    categoryName: 'Rice Dishes',
    costPrice: 1000, price: 2200,
    modifierNames: ['Choose your rice', 'Choose your protein'],
    addOnNames: ['Extra toppings'],
    packNames: ['Standard Pack', 'Medium Pack'],
    tags: ['rice', 'stew', 'nigerian', 'comfort-food'],
    maxQuantity: 20, volumePerPortion: 0.5, volumeUnit: 'kg',
    variations: [],
  },
  {
    name: 'Native Jollof Rice',
    description: 'Firewood-cooked jollof with smoky flavour and palm oil richness.',
    categoryName: 'Rice Dishes',
    costPrice: 1600, price: 3200,
    modifierNames: ['Choose your protein', 'Spice level'],
    addOnNames: ['Extra toppings', 'Sauces & Dips'],
    packNames: ['Standard Pack', 'Medium Pack', 'Large Pack'],
    tags: ['native', 'jollof', 'smoky', 'nigerian', 'premium'],
    maxQuantity: 8, volumePerPortion: 0.6, volumeUnit: 'kg',
    variations: [
      { name: 'Regular', costPrice: 1600, price: 3200, sku: 'NAT-REG', stock: 50 },
      { name: 'Large', costPrice: 2200, price: 4500, sku: 'NAT-LRG', stock: 30 },
    ],
  },

  // ── Swallow & Soups ──
  {
    name: 'Swallow & Soup Combo',
    description: 'Choose your swallow and soup — served with assorted meat.',
    categoryName: 'Swallow & Soups',
    costPrice: 1000, price: 2000,
    modifierNames: ['Choose your swallow', 'Choose your soup', 'Spice level'],
    addOnNames: ['Soup boosters'],
    packNames: ['Bowl Pack', 'Standard Pack'],
    tags: ['swallow', 'soup', 'nigerian', 'comfort-food', 'local'],
    maxQuantity: 20, volumePerPortion: 0.6, volumeUnit: 'kg',
    variations: [
      { name: 'Single Wrap', costPrice: 1000, price: 2000, sku: 'SWL-SNG', stock: 100 },
      { name: 'Double Wrap', costPrice: 1600, price: 3200, sku: 'SWL-DBL', stock: 60 },
    ],
  },
  {
    name: 'Egusi Soup (Bowl Only)',
    description: 'Rich melon seed soup loaded with vegetables and assorted meat. No swallow.',
    categoryName: 'Swallow & Soups',
    costPrice: 1200, price: 2500,
    modifierNames: ['Spice level'],
    addOnNames: ['Soup boosters', 'Bread sides'],
    packNames: ['Bowl Pack'],
    tags: ['egusi', 'soup', 'nigerian', 'keto-friendly'],
    maxQuantity: 10, volumePerPortion: 0.4, volumeUnit: 'kg',
    variations: [],
  },
  {
    name: 'Pounded Yam & Efo Riro',
    description: 'Smooth pounded yam with rich vegetable soup.',
    categoryName: 'Swallow & Soups',
    costPrice: 1400, price: 2800,
    modifierNames: ['Spice level'],
    addOnNames: ['Soup boosters', 'Extra toppings'],
    packNames: ['Bowl Pack', 'Standard Pack'],
    tags: ['pounded-yam', 'efo-riro', 'yoruba', 'nigerian'],
    maxQuantity: 12, volumePerPortion: 0.7, volumeUnit: 'kg',
    variations: [],
  },
  {
    name: 'Amala & Ewedu + Gbegiri',
    description: 'Classic Yoruba combo — smooth amala with ewedu and gbegiri.',
    categoryName: 'Swallow & Soups',
    costPrice: 1000, price: 2000,
    modifierNames: ['Spice level'],
    addOnNames: ['Soup boosters'],
    packNames: ['Bowl Pack'],
    tags: ['amala', 'ewedu', 'gbegiri', 'yoruba', 'campus-fav'],
    maxQuantity: 20, volumePerPortion: 0.6, volumeUnit: 'kg',
    variations: [],
  },

  // ── Grills & Protein ──
  {
    name: 'Suya Platter',
    description: 'Spicy grilled beef suya strips served with sliced onions, tomatoes, and suya pepper.',
    categoryName: 'Grills & Protein',
    costPrice: 2000, price: 3500,
    modifierNames: ['Spice level'],
    addOnNames: ['Sauces & Dips', 'Bread sides'],
    packNames: ['Standard Pack', 'Premium Box'],
    tags: ['suya', 'grill', 'spicy', 'nigerian', 'snack'],
    maxQuantity: 10, volumePerPortion: 0.3, volumeUnit: 'kg',
    variations: [
      { name: 'Small (200g)', costPrice: 1200, price: 2000, sku: 'SUY-SM', stock: 50 },
      { name: 'Regular (350g)', costPrice: 2000, price: 3500, sku: 'SUY-REG', stock: 40 },
      { name: 'Large (500g)', costPrice: 2800, price: 5000, sku: 'SUY-LRG', stock: 20 },
    ],
  },
  {
    name: 'Grilled Chicken',
    description: 'Whole grilled chicken thigh marinated in house spices.',
    categoryName: 'Grills & Protein',
    costPrice: 1500, price: 3000,
    modifierNames: ['Spice level'],
    addOnNames: ['Sauces & Dips', 'Salad extras'],
    packNames: ['Standard Pack', 'Premium Box'],
    tags: ['chicken', 'grill', 'protein', 'healthy'],
    maxQuantity: 15, volumePerPortion: 0.35, volumeUnit: 'kg',
    variations: [
      { name: 'Quarter', costPrice: 1000, price: 1800, sku: 'GCH-QTR', stock: 30 },
      { name: 'Half', costPrice: 1500, price: 3000, sku: 'GCH-HLF', stock: 25 },
      { name: 'Full', costPrice: 2800, price: 5500, sku: 'GCH-FUL', stock: 10 },
    ],
  },
  {
    name: 'Peppered Turkey',
    description: 'Deep-fried turkey tossed in spicy pepper sauce.',
    categoryName: 'Grills & Protein',
    costPrice: 2000, price: 3500,
    modifierNames: ['Spice level'],
    addOnNames: ['Sauces & Dips'],
    packNames: ['Standard Pack'],
    tags: ['turkey', 'peppered', 'spicy', 'nigerian', 'premium'],
    maxQuantity: 8, volumePerPortion: 0.3, volumeUnit: 'kg',
    variations: [],
  },
  {
    name: 'Asun (Spicy Goat)',
    description: 'Smoky spiced goat meat — a party favourite.',
    categoryName: 'Grills & Protein',
    costPrice: 2500, price: 4500,
    modifierNames: ['Spice level'],
    addOnNames: ['Sauces & Dips', 'Bread sides'],
    packNames: ['Standard Pack', 'Premium Box'],
    tags: ['asun', 'goat', 'spicy', 'party-food', 'nigerian'],
    maxQuantity: 6, volumePerPortion: 0.3, volumeUnit: 'kg',
    variations: [],
  },

  // ── Pasta & Noodles ──
  {
    name: 'Pasta with Sauce',
    description: 'Your choice of pasta and sauce, served with grilled chicken or beef.',
    categoryName: 'Pasta & Noodles',
    costPrice: 1000, price: 2200,
    modifierNames: ['Choose your pasta', 'Choose your sauce', 'Choose your protein'],
    addOnNames: ['Extra toppings', 'Salad extras'],
    packNames: ['Standard Pack', 'Medium Pack'],
    tags: ['pasta', 'spaghetti', 'italian', 'comfort-food'],
    maxQuantity: 15, volumePerPortion: 0.4, volumeUnit: 'kg',
    variations: [
      { name: 'Regular', costPrice: 1000, price: 2200, sku: 'PST-REG', stock: 80 },
      { name: 'Large', costPrice: 1500, price: 3200, sku: 'PST-LRG', stock: 40 },
    ],
  },
  {
    name: 'Indomie Special',
    description: 'Stir-fried Indomie noodles with eggs, vegetables and sausage.',
    categoryName: 'Pasta & Noodles',
    costPrice: 800, price: 1800,
    modifierNames: ['Spice level'],
    addOnNames: ['Extra toppings'],
    packNames: ['Standard Pack'],
    tags: ['indomie', 'noodles', 'quick', 'student-fav'],
    maxQuantity: 20, volumePerPortion: 0.35, volumeUnit: 'kg',
    variations: [
      { name: 'Single Pack', costPrice: 800, price: 1800, sku: 'IND-SNG', stock: 100 },
      { name: 'Double Pack', costPrice: 1300, price: 2800, sku: 'IND-DBL', stock: 50 },
    ],
  },
  {
    name: 'Jollof Spaghetti',
    description: 'Nigerian-style jollof spaghetti with peppers and onions.',
    categoryName: 'Pasta & Noodles',
    costPrice: 900, price: 2000,
    modifierNames: ['Choose your protein', 'Spice level'],
    addOnNames: ['Extra toppings'],
    packNames: ['Standard Pack'],
    tags: ['jollof', 'spaghetti', 'nigerian', 'fusion'],
    maxQuantity: 15, volumePerPortion: 0.4, volumeUnit: 'kg',
    variations: [],
  },

  // ── Sides & Extras ──
  {
    name: 'Fried Plantain (Dodo)',
    description: 'Sweet ripe plantain, perfectly fried to golden perfection.',
    categoryName: 'Sides & Extras',
    costPrice: 200, price: 500,
    modifierNames: [],
    addOnNames: ['Sauces & Dips'],
    packNames: ['Standard Pack'],
    tags: ['plantain', 'dodo', 'side', 'snack'],
    maxQuantity: 30, volumePerPortion: 0.15, volumeUnit: 'kg',
    variations: [
      { name: 'Small (3 pieces)', costPrice: 200, price: 500, sku: 'DOD-SM', stock: 100 },
      { name: 'Large (6 pieces)', costPrice: 350, price: 800, sku: 'DOD-LG', stock: 60 },
    ],
  },
  {
    name: 'Moi Moi',
    description: 'Steamed bean pudding with egg and fish.',
    categoryName: 'Sides & Extras',
    costPrice: 300, price: 600,
    modifierNames: [],
    addOnNames: [],
    packNames: ['Standard Pack'],
    tags: ['moi-moi', 'beans', 'healthy', 'side'],
    maxQuantity: 20, volumePerPortion: 0.2, volumeUnit: 'kg',
    variations: [],
  },
  {
    name: 'Coleslaw',
    description: 'Fresh creamy coleslaw — perfect with grills and rice.',
    categoryName: 'Sides & Extras',
    costPrice: 150, price: 400,
    modifierNames: [],
    addOnNames: [],
    packNames: ['Standard Pack'],
    tags: ['coleslaw', 'salad', 'side', 'healthy'],
    maxQuantity: 25, volumePerPortion: 0.15, volumeUnit: 'kg',
    variations: [],
  },
  {
    name: 'Egg (Fried/Boiled)',
    description: 'Fried or boiled egg — choose your style.',
    categoryName: 'Sides & Extras',
    costPrice: 150, price: 400,
    modifierNames: [],
    addOnNames: [],
    packNames: [],
    tags: ['egg', 'protein', 'side', 'quick'],
    maxQuantity: 30,
    variations: [
      { name: 'Fried Egg', costPrice: 150, price: 400, sku: 'EGG-FRI', stock: 100 },
      { name: 'Boiled Egg', costPrice: 120, price: 350, sku: 'EGG-BOI', stock: 100 },
    ],
  },
  {
    name: 'Beans Porridge',
    description: 'Seasoned beans porridge with palm oil and peppers. Optionally served with plantain.',
    categoryName: 'Sides & Extras',
    costPrice: 500, price: 1200,
    modifierNames: ['Spice level'],
    addOnNames: ['Extra toppings'],
    packNames: ['Standard Pack', 'Medium Pack'],
    tags: ['beans', 'porridge', 'nigerian', 'comfort-food'],
    maxQuantity: 15, volumePerPortion: 0.4, volumeUnit: 'kg',
    variations: [],
  },

  // ── Drinks ──
  {
    name: 'Chapman',
    description: 'Classic Nigerian cocktail — Fanta, Sprite, Ribena, cucumber, lemon.',
    categoryName: 'Drinks',
    costPrice: 300, price: 800,
    modifierNames: ['Choose your drink size'],
    addOnNames: ['Drink add-ons'],
    packNames: [],
    tags: ['chapman', 'cocktail', 'nigerian', 'cold-drink'],
    maxQuantity: 20, volumePerPortion: 0.5, volumeUnit: 'l',
    variations: [],
  },
  {
    name: 'Zobo Drink',
    description: 'Chilled hibiscus drink with ginger and pineapple.',
    categoryName: 'Drinks',
    costPrice: 200, price: 600,
    modifierNames: ['Choose your drink size'],
    addOnNames: ['Drink add-ons'],
    packNames: [],
    tags: ['zobo', 'hibiscus', 'nigerian', 'cold-drink', 'healthy'],
    maxQuantity: 25, volumePerPortion: 0.5, volumeUnit: 'l',
    variations: [],
  },
  {
    name: 'Fresh Smoothie',
    description: 'Blended fruit smoothie — banana, mango, or mixed berries.',
    categoryName: 'Drinks',
    costPrice: 400, price: 1200,
    modifierNames: ['Choose your drink size'],
    addOnNames: ['Drink add-ons'],
    packNames: [],
    tags: ['smoothie', 'fruit', 'healthy', 'cold-drink'],
    maxQuantity: 15, volumePerPortion: 0.4, volumeUnit: 'l',
    variations: [
      { name: 'Banana Smoothie', costPrice: 400, price: 1200, sku: 'SMT-BAN', stock: 30 },
      { name: 'Mango Smoothie', costPrice: 450, price: 1300, sku: 'SMT-MNG', stock: 25 },
      { name: 'Mixed Berry', costPrice: 500, price: 1500, sku: 'SMT-MIX', stock: 20 },
    ],
  },
  {
    name: 'Bottle Water',
    description: 'Chilled bottled water.',
    categoryName: 'Drinks',
    costPrice: 80, price: 200,
    modifierNames: [],
    addOnNames: [],
    packNames: [],
    tags: ['water', 'cold-drink', 'basic'],
    maxQuantity: 50,
    variations: [],
  },
  {
    name: 'Soft Drinks (Can)',
    description: 'Coca-Cola, Fanta, Sprite, or Pepsi.',
    categoryName: 'Drinks',
    costPrice: 200, price: 500,
    modifierNames: [],
    addOnNames: ['Drink add-ons'],
    packNames: [],
    tags: ['soda', 'soft-drink', 'cold-drink'],
    maxQuantity: 30,
    variations: [
      { name: 'Coca-Cola', costPrice: 200, price: 500, sku: 'SOD-COK', stock: 50 },
      { name: 'Fanta', costPrice: 200, price: 500, sku: 'SOD-FAN', stock: 50 },
      { name: 'Sprite', costPrice: 200, price: 500, sku: 'SOD-SPR', stock: 50 },
      { name: 'Pepsi', costPrice: 200, price: 500, sku: 'SOD-PEP', stock: 40 },
    ],
  },

  // ── Shawarma & Wraps ──
  {
    name: 'Chicken Shawarma',
    description: 'Grilled chicken shawarma with fresh veggies, coleslaw and signature sauce.',
    categoryName: 'Shawarma & Wraps',
    costPrice: 1000, price: 2200,
    modifierNames: ['Choose wrap type', 'Spice level'],
    addOnNames: ['Shawarma extras', 'Sauces & Dips'],
    packNames: ['Standard Pack'],
    tags: ['shawarma', 'chicken', 'wrap', 'quick', 'student-fav'],
    maxQuantity: 15, volumePerPortion: 0.35, volumeUnit: 'kg',
    variations: [
      { name: 'Regular', costPrice: 1000, price: 2200, sku: 'SHA-REG', stock: 60 },
      { name: 'Double Meat', costPrice: 1600, price: 3200, sku: 'SHA-DBL', stock: 30 },
    ],
  },
  {
    name: 'Beef Shawarma',
    description: 'Spiced beef strips in a warm wrap with all the fixings.',
    categoryName: 'Shawarma & Wraps',
    costPrice: 1200, price: 2500,
    modifierNames: ['Choose wrap type', 'Spice level'],
    addOnNames: ['Shawarma extras', 'Sauces & Dips'],
    packNames: ['Standard Pack'],
    tags: ['shawarma', 'beef', 'wrap', 'premium'],
    maxQuantity: 12, volumePerPortion: 0.35, volumeUnit: 'kg',
    variations: [],
  },
  {
    name: 'Veggie Wrap',
    description: 'Grilled vegetables with hummus and feta in a tortilla wrap.',
    categoryName: 'Shawarma & Wraps',
    costPrice: 800, price: 1800,
    modifierNames: ['Choose wrap type'],
    addOnNames: ['Shawarma extras', 'Salad extras'],
    packNames: ['Standard Pack'],
    tags: ['veggie', 'wrap', 'vegetarian', 'healthy'],
    maxQuantity: 10, volumePerPortion: 0.3, volumeUnit: 'kg',
    variations: [],
  },

  // ── Desserts & Snacks ──
  {
    name: 'Puff Puff',
    description: 'Fluffy deep-fried dough balls — the ultimate Nigerian snack.',
    categoryName: 'Desserts & Snacks',
    costPrice: 200, price: 500,
    modifierNames: [],
    addOnNames: ['Dessert toppings', 'Sauces & Dips'],
    packNames: ['Standard Pack'],
    tags: ['puff-puff', 'snack', 'nigerian', 'sweet', 'quick'],
    maxQuantity: 25, volumePerPortion: 0.2, volumeUnit: 'kg',
    variations: [
      { name: '5 Pieces', costPrice: 200, price: 500, sku: 'PPF-5', stock: 80 },
      { name: '10 Pieces', costPrice: 350, price: 800, sku: 'PPF-10', stock: 50 },
    ],
  },
  {
    name: 'Chin Chin',
    description: 'Crunchy fried pastry snack — sweet and addictive.',
    categoryName: 'Desserts & Snacks',
    costPrice: 150, price: 400,
    modifierNames: [],
    addOnNames: ['Dessert toppings'],
    packNames: ['Standard Pack'],
    tags: ['chin-chin', 'snack', 'nigerian', 'sweet'],
    maxQuantity: 30, volumePerPortion: 0.1, volumeUnit: 'kg',
    variations: [
      { name: 'Small Pack', costPrice: 150, price: 400, sku: 'CHN-SM', stock: 60 },
      { name: 'Large Pack', costPrice: 300, price: 700, sku: 'CHN-LG', stock: 30 },
    ],
  },
  {
    name: 'Meat Pie',
    description: 'Freshly baked meat pie with minced beef filling.',
    categoryName: 'Desserts & Snacks',
    costPrice: 250, price: 600,
    modifierNames: [],
    addOnNames: ['Sauces & Dips'],
    packNames: [],
    tags: ['meat-pie', 'pastry', 'snack', 'baked'],
    maxQuantity: 20,
    variations: [],
  },
  {
    name: 'Spring Rolls (4pcs)',
    description: 'Crispy spring rolls stuffed with seasoned vegetables and minced chicken.',
    categoryName: 'Desserts & Snacks',
    costPrice: 300, price: 700,
    modifierNames: [],
    addOnNames: ['Sauces & Dips'],
    packNames: ['Standard Pack'],
    tags: ['spring-rolls', 'snack', 'crispy', 'small-chops'],
    maxQuantity: 15,
    variations: [],
  },
  {
    name: 'Samosa (3pcs)',
    description: 'Spiced potato and meat samosas — crispy and flavourful.',
    categoryName: 'Desserts & Snacks',
    costPrice: 250, price: 600,
    modifierNames: ['Spice level'],
    addOnNames: ['Sauces & Dips'],
    packNames: [],
    tags: ['samosa', 'snack', 'small-chops', 'spicy'],
    maxQuantity: 15,
    variations: [],
  },
];

// ═══════════════════════════════════════════════════════════

async function seed() {
  console.log('\n🍽️  Seeding Chowdeck-style Menu for food vendor...\n');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const User = mongoose.model('User', UserSchema);
  const Vendor = mongoose.model('Vendor', VendorSchema);
  const MenuCategory = mongoose.model('MenuCategory', MenuCategorySchema);
  const Modifier = mongoose.model('Modifier', ModifierSchema);
  const AddOn = mongoose.model('AddOn', AddOnSchema);
  const MenuPack = mongoose.model('MenuPack', MenuPackSchema);
  const MenuItem = mongoose.model('MenuItem', MenuItemSchema);

  // ── 1. Create User ──
  const passwordHash = await bcrypt.hash(VENDOR_INFO.password, 12);
  let user = await User.findOne({ email: VENDOR_INFO.email });
  if (!user) {
    user = await User.create({
      firstName: VENDOR_INFO.firstName,
      lastName: VENDOR_INFO.lastName,
      email: VENDOR_INFO.email,
      password: passwordHash,
      role: 'vendor',
      isVerified: true,
    });
    console.log(`👤 Created user: ${VENDOR_INFO.email}`);
  } else {
    console.log(`👤 User already exists: ${VENDOR_INFO.email}`);
  }

  // ── 2. Create Vendor ──
  let vendor = await Vendor.findOne({ owner: user._id });
  if (!vendor) {
    const defaultHours = [
      'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    ].map((day) => ({
      day,
      open: day === 'sunday' ? '10:00' : '07:00',
      close: day === 'sunday' ? '20:00' : '22:00',
      isClosed: false,
    }));

    vendor = await Vendor.create({
      owner: user._id,
      storeName: VENDOR_INFO.storeName,
      subdomain: VENDOR_INFO.subdomain,
      description: VENDOR_INFO.description,
      category: VENDOR_INFO.category,
      phone: VENDOR_INFO.phone,
      address: VENDOR_INFO.address,
      tags: VENDOR_INFO.tags,
      businessType: 'physical_product',
      isInsideCampus: true,
      location: { type: 'Point', coordinates: [3.3792, 6.5244] },
      status: 'approved',
      isOnline: true,
      businessHours: defaultHours,
      rating: 4.7,
      totalOrders: 328,
      preparationTime: 25,
      deliveryFee: 200,
      baseDeliveryFee: 600,
      packs: [
        { name: 'Standard Pack', price: 200, isActive: true },
        { name: 'Large Pack', price: 500, isActive: true },
      ],
      packagingFee: 200,
      minimumOrder: 1000,
    });
    console.log(`🏪 Created vendor: ${VENDOR_INFO.storeName}`);
  } else {
    console.log(`🏪 Vendor already exists: ${vendor.storeName}`);
  }

  const vendorId = vendor._id;

  // ── 3. Seed MenuCategories ──
  const categoryMap = new Map();
  for (const cat of CATEGORIES) {
    let existing = await MenuCategory.findOne({ vendor: vendorId, name: cat.name });
    if (!existing) {
      existing = await MenuCategory.create({
        vendor: vendorId,
        name: cat.name,
        sortOrder: cat.sortOrder,
        isActive: true,
      });
      console.log(`  📁 Category: ${cat.name}`);
    }
    categoryMap.set(cat.name, existing._id);
  }
  console.log(`\n✅ ${categoryMap.size} categories ready\n`);

  // ── 4. Seed Modifiers ──
  const modifierMap = new Map();
  for (const mod of MODIFIERS) {
    let existing = await Modifier.findOne({ vendor: vendorId, name: mod.name });
    if (!existing) {
      existing = await Modifier.create({
        vendor: vendorId,
        name: mod.name,
        optionGroup: mod.optionGroup,
        items: mod.items,
        maxSelection: mod.maxSelection,
        publishNow: true,
      });
      console.log(`  🔧 Modifier: ${mod.name} (${mod.items.length} options)`);
    }
    modifierMap.set(mod.name, existing._id);
  }
  console.log(`\n✅ ${modifierMap.size} modifiers ready\n`);

  // ── 5. Seed Add-ons ──
  const addOnMap = new Map();
  for (const ao of ADDONS) {
    let existing = await AddOn.findOne({ vendor: vendorId, name: ao.name });
    if (!existing) {
      existing = await AddOn.create({
        vendor: vendorId,
        name: ao.name,
        items: ao.items,
        minSelection: ao.minSelection,
        maxSelection: ao.maxSelection,
        publishNow: true,
      });
      console.log(`  ➕ Add-on: ${ao.name} (${ao.items.length} options)`);
    }
    addOnMap.set(ao.name, existing._id);
  }
  console.log(`\n✅ ${addOnMap.size} add-ons ready\n`);

  // ── 6. Seed MenuPacks ──
  const packMap = new Map();
  for (const pk of PACKS) {
    let existing = await MenuPack.findOne({ vendor: vendorId, name: pk.name });
    if (!existing) {
      existing = await MenuPack.create({
        vendor: vendorId,
        name: pk.name,
        description: pk.description,
        price: pk.price,
        maxVolume: pk.maxVolume,
      });
      console.log(`  📦 Pack: ${pk.name} (₦${pk.price})`);
    }
    packMap.set(pk.name, existing._id);
  }
  console.log(`\n✅ ${packMap.size} packs ready\n`);

  // ── 7. Seed MenuItems ──
  let itemCount = 0;
  for (const item of MENU_ITEMS) {
    const exists = await MenuItem.findOne({ vendor: vendorId, name: item.name });
    if (exists) {
      console.log(`  ⏭️  Skip item (exists): ${item.name}`);
      continue;
    }

    const modifierIds = (item.modifierNames || [])
      .map((n) => modifierMap.get(n))
      .filter(Boolean);
    const addOnIds = (item.addOnNames || [])
      .map((n) => addOnMap.get(n))
      .filter(Boolean);
    const packIds = (item.packNames || [])
      .map((n) => packMap.get(n))
      .filter(Boolean);

    await MenuItem.create({
      vendor: vendorId,
      name: item.name,
      description: item.description,
      category: categoryMap.get(item.categoryName) || null,
      trackStock: (item.variations && item.variations.length > 0),
      inStock: item.variations
        ? item.variations.reduce((sum, v) => sum + (v.stock || 0), 0)
        : 0,
      costPrice: item.costPrice,
      price: item.price,
      sku: '',
      variations: item.variations || [],
      modifiers: modifierIds,
      addOns: addOnIds,
      packs: packIds,
      tags: item.tags || [],
      maxQuantity: item.maxQuantity || 10,
      volumePerPortion: item.volumePerPortion || 0,
      volumeUnit: item.volumeUnit || 'kg',
      imageUrl: '',
      publishItem: true,
    });

    const modStr = modifierIds.length ? ` | ${modifierIds.length} modifiers` : '';
    const addStr = addOnIds.length ? ` | ${addOnIds.length} add-ons` : '';
    const varStr = (item.variations?.length) ? ` | ${item.variations.length} variations` : '';
    console.log(`  🍛 Item: ${item.name} (₦${item.price})${varStr}${modStr}${addStr}`);
    itemCount++;
  }

  console.log(`\n✅ ${itemCount} menu items created\n`);

  // ── Summary ──
  console.log('═'.repeat(60));
  console.log('  SEED COMPLETE');
  console.log('═'.repeat(60));
  console.log(`  Vendor:     ${VENDOR_INFO.storeName}`);
  console.log(`  Category:   ${VENDOR_INFO.category}`);
  console.log(`  Email:      ${VENDOR_INFO.email}`);
  console.log(`  Password:   ${VENDOR_INFO.password}`);
  console.log(`  Categories: ${categoryMap.size}`);
  console.log(`  Modifiers:  ${modifierMap.size}`);
  console.log(`  Add-ons:    ${addOnMap.size}`);
  console.log(`  Packs:      ${packMap.size}`);
  console.log(`  Items:      ${itemCount}`);
  console.log('═'.repeat(60));

  await mongoose.disconnect();
  console.log('\n🔌 Disconnected\n');
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  mongoose.disconnect();
  process.exit(1);
});
