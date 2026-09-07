/**
 * Seed script: Populates Modifiers and AddOns for existing food vendor menu items.
 * 
 * Usage: npx ts-node scripts/seed-modifiers.ts
 * 
 * Reads MONGODB_URI from .env
 */
import * as dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

const ModifierSchema = new mongoose.Schema({
  vendor: { type: mongoose.Types.ObjectId, ref: 'Vendor', required: true },
  name: { type: String, required: true },
  optionGroup: String,
  items: [{ name: { type: String, required: true }, price: { type: Number, required: true, min: 0 } }],
  minSelection: { type: Number, min: 0, default: 0 },
  maxSelection: { type: Number, required: true, min: 1, default: 1 },
  publishNow: { type: Boolean, default: false },
}, { timestamps: true });

const AddOnSchema = new mongoose.Schema({
  vendor: { type: mongoose.Types.ObjectId, ref: 'Vendor', required: true },
  name: { type: String, required: true },
  items: [{ name: { type: String, required: true }, price: { type: Number, required: true, min: 0 } }],
  minSelection: { type: Number, min: 0 },
  maxSelection: { type: Number, required: true, min: 1, default: 1 },
  publishNow: { type: Boolean, default: false },
}, { timestamps: true });

const MenuItemSchema = new mongoose.Schema({}, { strict: false });

const Modifier = mongoose.model('Modifier', ModifierSchema);
const AddOn = mongoose.model('AddOn', AddOnSchema);
const MenuItem = mongoose.model('MenuItem', MenuItemSchema);

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set in .env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  // Find all food vendor menu items
  const menuItems: any[] = await MenuItem.find({}).lean();
  console.log(`Found ${menuItems.length} menu items total`);

  if (menuItems.length === 0) {
    console.log('No menu items found. Exiting.');
    await mongoose.disconnect();
    return;
  }

  // Group menu items by vendor
  const vendorItemMap: Record<string, any[]> = {};
  for (const item of menuItems) {
    const vendorId = item.vendor?.toString();
    if (!vendorId) continue;
    if (!vendorItemMap[vendorId]) vendorItemMap[vendorId] = [];
    vendorItemMap[vendorId].push(item);
  }

  for (const [vendorId, items] of Object.entries(vendorItemMap)) {
    console.log(`\n--- Processing vendor ${vendorId} with ${items.length} items ---`);

    // Check if modifiers already exist for this vendor
    const existingModifiers = await Modifier.countDocuments({ vendor: new mongoose.Types.ObjectId(vendorId) });
    if (existingModifiers > 0) {
      console.log(`  Vendor already has ${existingModifiers} modifiers. Skipping.`);
      continue;
    }

    // Create shared modifiers for this vendor
    const takeAwayPack = await Modifier.create({
      vendor: new mongoose.Types.ObjectId(vendorId),
      name: 'Take Away Pack',
      optionGroup: 'packaging',
      items: [
        { name: 'Take Away Pack', price: 200 },
      ],
      minSelection: 1,
      maxSelection: 1,
      publishNow: true,
    });
    console.log(`  Created modifier: ${takeAwayPack.name} (id: ${takeAwayPack._id})`);

    const soupChoice = await Modifier.create({
      vendor: new mongoose.Types.ObjectId(vendorId),
      name: 'Soup Choice',
      optionGroup: 'soup',
      items: [
        { name: 'Egusi', price: 0 },
        { name: 'Ewedu', price: 0 },
        { name: 'Ogbono', price: 0 },
        { name: 'Efo Riro', price: 0 },
        { name: 'Pepper Soup', price: 100 },
      ],
      minSelection: 1,
      maxSelection: 1,
      publishNow: true,
    });
    console.log(`  Created modifier: ${soupChoice.name} (id: ${soupChoice._id})`);

    // Create shared add-ons for this vendor
    const extraPortion = await AddOn.create({
      vendor: new mongoose.Types.ObjectId(vendorId),
      name: 'Extra Portion',
      items: [
        { name: 'White Rice', price: 550 },
        { name: 'Fried Rice', price: 550 },
        { name: 'Jollof Rice', price: 550 },
        { name: 'Plain Beans', price: 550 },
        { name: 'Beans (ewa Agoyin)', price: 550 },
        { name: 'Yam Pottage', price: 750 },
      ],
      minSelection: 0,
      maxSelection: 4,
      publishNow: true,
    });
    console.log(`  Created add-on: ${extraPortion.name} (id: ${extraPortion._id})`);

    const extraSwallow = await AddOn.create({
      vendor: new mongoose.Types.ObjectId(vendorId),
      name: 'Extra Swallow',
      items: [
        { name: 'Amala', price: 502.82 },
        { name: 'Pounded Yam', price: 552.82 },
        { name: 'Semo', price: 452.82 },
        { name: 'Fufu', price: 452.82 },
      ],
      minSelection: 0,
      maxSelection: 4,
      publishNow: true,
    });
    console.log(`  Created add-on: ${extraSwallow.name} (id: ${extraSwallow._id})`);

    const proteinChoice = await AddOn.create({
      vendor: new mongoose.Types.ObjectId(vendorId),
      name: 'Protein Choice',
      items: [
        { name: 'Big Ponmo', price: 500 },
        { name: 'Beef', price: 565.32 },
        { name: 'Hake Fish', price: 1002.82 },
        { name: 'Smoked Fish (Big)', price: 1250 },
        { name: 'Assorted Meat', price: 752.82 },
        { name: 'Turkey', price: 1500 },
        { name: 'Chicken', price: 1200 },
        { name: 'Egg (Boiled)', price: 300 },
      ],
      minSelection: 0,
      maxSelection: 10,
      publishNow: true,
    });
    console.log(`  Created add-on: ${proteinChoice.name} (id: ${proteinChoice._id})`);

    const drinkChoice = await AddOn.create({
      vendor: new mongoose.Types.ObjectId(vendorId),
      name: 'Drinks',
      items: [
        { name: 'Water (50cl)', price: 200 },
        { name: 'Coca-Cola', price: 350 },
        { name: 'Fanta', price: 350 },
        { name: 'Sprite', price: 350 },
        { name: 'Malt', price: 450 },
        { name: 'Zobo', price: 300 },
        { name: 'Chapman', price: 500 },
      ],
      minSelection: 0,
      maxSelection: 5,
      publishNow: true,
    });
    console.log(`  Created add-on: ${drinkChoice.name} (id: ${drinkChoice._id})`);

    // Assign modifiers and add-ons to items based on their name
    for (const item of items) {
      const itemName = (item.name || '').toLowerCase();
      const modifierIds: mongoose.Types.ObjectId[] = [];
      const addOnIds: mongoose.Types.ObjectId[] = [];

      // Every food item gets the Take Away Pack modifier (required)
      modifierIds.push(takeAwayPack._id as mongoose.Types.ObjectId);

      // Swallow items get Soup Choice modifier (required)
      const swallowKeywords = ['pounded yam', 'amala', 'semo', 'fufu', 'eba', 'tuwo'];
      const isSwallow = swallowKeywords.some(kw => itemName.includes(kw));
      if (isSwallow) {
        modifierIds.push(soupChoice._id as mongoose.Types.ObjectId);
        addOnIds.push(extraSwallow._id as mongoose.Types.ObjectId);
      }

      // Rice and beans items get Extra Portion add-on
      const riceKeywords = ['rice', 'jollof', 'fried rice', 'beans', 'porridge'];
      const isRice = riceKeywords.some(kw => itemName.includes(kw));
      if (isRice) {
        addOnIds.push(extraPortion._id as mongoose.Types.ObjectId);
      }

      // All food items get protein and drinks
      addOnIds.push(proteinChoice._id as mongoose.Types.ObjectId);
      addOnIds.push(drinkChoice._id as mongoose.Types.ObjectId);

      await MenuItem.updateOne(
        { _id: item._id },
        { $set: { modifiers: modifierIds, addOns: addOnIds } },
      );
      console.log(`  Updated "${item.name}": ${modifierIds.length} modifiers, ${addOnIds.length} add-ons`);
    }
  }

  console.log('\n✅ Seed complete!');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
