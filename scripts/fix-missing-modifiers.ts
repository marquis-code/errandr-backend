import mongoose from 'mongoose';
import { MenuItemSchema } from '../src/modules/menu/schemas/menu-item.schema';
import { ModifierSchema } from '../src/modules/menu/schemas/modifier.schema';
import { AddOnSchema } from '../src/modules/menu/schemas/add-on.schema';
import * as dotenv from 'dotenv';
import { join } from 'path';

// Load .env
dotenv.config({ path: join(__dirname, '../.env') });

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/erranders';
  console.log('Connecting to database...', uri);
  await mongoose.connect(uri);
  
  const MenuItem = mongoose.model('MenuItem', MenuItemSchema);
  const Modifier = mongoose.model('Modifier', ModifierSchema);
  const AddOn = mongoose.model('AddOn', AddOnSchema);

  const menuItems = await MenuItem.find({ $or: [{ modifiers: { $size: 0 } }, { modifiers: { $exists: false } }] });
  console.log(`Found ${menuItems.length} menu items without modifiers`);

  for (const item of menuItems) {
    const vendorId = item.vendor?.toString();
    if (!vendorId) continue;

    console.log(`Processing ${item.name}...`);
    
    // Find existing modifiers and add-ons for this vendor
    const takeAwayPack = await Modifier.findOne({ vendor: new mongoose.Types.ObjectId(vendorId), name: 'Take Away Pack' });
    const soupChoice = await Modifier.findOne({ vendor: new mongoose.Types.ObjectId(vendorId), name: 'Soup Choice' });
    const extraSwallow = await AddOn.findOne({ vendor: new mongoose.Types.ObjectId(vendorId), name: 'Extra Swallow' });
    const extraPortion = await AddOn.findOne({ vendor: new mongoose.Types.ObjectId(vendorId), name: 'Extra Portion' });
    const proteinChoice = await AddOn.findOne({ vendor: new mongoose.Types.ObjectId(vendorId), name: 'Protein Choice' });
    const drinkChoice = await AddOn.findOne({ vendor: new mongoose.Types.ObjectId(vendorId), name: 'Drinks' });

    if (!takeAwayPack || !proteinChoice || !drinkChoice) {
      console.log(`Missing base configurations for vendor ${vendorId}, skipping item ${item.name}`);
      continue;
    }

    const itemName = (item.name || '').toLowerCase();
    const modifierIds: mongoose.Types.ObjectId[] = [];
    const addOnIds: mongoose.Types.ObjectId[] = [];

    // Every food item gets Take Away Pack
    modifierIds.push(takeAwayPack._id as mongoose.Types.ObjectId);

    // Swallow keywords
    const swallowKeywords = ['pounded yam', 'amala', 'semo', 'fufu', 'eba', 'tuwo', 'swallow'];
    if (swallowKeywords.some(kw => itemName.includes(kw))) {
      if (soupChoice) modifierIds.push(soupChoice._id as mongoose.Types.ObjectId);
      if (extraSwallow) addOnIds.push(extraSwallow._id as mongoose.Types.ObjectId);
    }

    // Rice keywords
    const riceKeywords = ['rice', 'jollof', 'fried rice', 'beans', 'porridge', 'pasta', 'spaghetti'];
    if (riceKeywords.some(kw => itemName.includes(kw))) {
      if (extraPortion) addOnIds.push(extraPortion._id as mongoose.Types.ObjectId);
    }

    // All food gets protein and drinks
    addOnIds.push(proteinChoice._id as mongoose.Types.ObjectId);
    addOnIds.push(drinkChoice._id as mongoose.Types.ObjectId);

    await MenuItem.updateOne(
      { _id: item._id },
      { $set: { modifiers: modifierIds, addOns: addOnIds } }
    );
    console.log(`  Updated "${item.name}": added ${modifierIds.length} modifiers, ${addOnIds.length} add-ons`);
  }

  console.log('Finished updating missing items!');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
