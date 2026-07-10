import mongoose from 'mongoose';
import { MenuItemSchema } from '../src/modules/menu/schemas/menu-item.schema';
import { ModifierSchema } from '../src/modules/menu/schemas/modifier.schema';
import { AddOnSchema } from '../src/modules/menu/schemas/add-on.schema';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '../.env') });

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/erranders';
  await mongoose.connect(uri);
  
  const MenuItem = mongoose.model('MenuItem', MenuItemSchema);
  const Modifier = mongoose.model('Modifier', ModifierSchema);
  const AddOn = mongoose.model('AddOn', AddOnSchema);

  const vendorId = '6a5095af1427cb6762f0cb31';

  // Force create the exact Chowdeck style modifiers
  const takeAwayPack = await Modifier.findOneAndUpdate(
    { vendor: new mongoose.Types.ObjectId(vendorId), name: 'Take Away Pack' },
    {
      vendor: new mongoose.Types.ObjectId(vendorId),
      name: 'Take Away Pack',
      optionGroup: 'packaging',
      items: [{ name: 'Take Away Pack', price: 200 }],
      minSelection: 1,
      maxSelection: 1,
      publishNow: true,
    },
    { upsert: true, new: true }
  );

  const soupChoice = await Modifier.findOneAndUpdate(
    { vendor: new mongoose.Types.ObjectId(vendorId), name: 'Soup Choice' },
    {
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
    },
    { upsert: true, new: true }
  );

  const extraSwallow = await AddOn.findOneAndUpdate(
    { vendor: new mongoose.Types.ObjectId(vendorId), name: 'Extra Swallow' },
    {
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
    },
    { upsert: true, new: true }
  );

  const extraPortion = await AddOn.findOneAndUpdate(
    { vendor: new mongoose.Types.ObjectId(vendorId), name: 'Extra Portion' },
    {
      vendor: new mongoose.Types.ObjectId(vendorId),
      name: 'Extra Portion',
      items: [
        { name: 'White Rice', price: 550 },
        { name: 'Fried Rice', price: 550 },
        { name: 'Jollof Rice', price: 550 },
      ],
      minSelection: 0,
      maxSelection: 4,
      publishNow: true,
    },
    { upsert: true, new: true }
  );

  const proteinChoice = await AddOn.findOneAndUpdate(
    { vendor: new mongoose.Types.ObjectId(vendorId), name: 'Protein Choice' },
    {
      vendor: new mongoose.Types.ObjectId(vendorId),
      name: 'Protein Choice',
      items: [
        { name: 'Big Ponmo', price: 500 },
        { name: 'Beef', price: 565.32 },
        { name: 'Hake Fish', price: 1002.82 },
        { name: 'Smoked Fish (Big)', price: 1250 },
      ],
      minSelection: 0,
      maxSelection: 10,
      publishNow: true,
    },
    { upsert: true, new: true }
  );

  const drinkChoice = await AddOn.findOneAndUpdate(
    { vendor: new mongoose.Types.ObjectId(vendorId), name: 'Drinks' },
    {
      vendor: new mongoose.Types.ObjectId(vendorId),
      name: 'Drinks',
      items: [
        { name: 'Water (50cl)', price: 200 },
        { name: 'Coca-Cola', price: 350 },
      ],
      minSelection: 0,
      maxSelection: 5,
      publishNow: true,
    },
    { upsert: true, new: true }
  );

  const menuItems = await MenuItem.find({ vendor: new mongoose.Types.ObjectId(vendorId) });
  console.log(`Found ${menuItems.length} menu items for Adewales Kitchen`);

  for (const item of menuItems) {
    const itemName = (item.name || '').toLowerCase();
    const modifierIds: mongoose.Types.ObjectId[] = [];
    const addOnIds: mongoose.Types.ObjectId[] = [];

    modifierIds.push(takeAwayPack._id as mongoose.Types.ObjectId);

    const swallowKeywords = ['pounded yam', 'amala', 'semo', 'fufu', 'eba', 'tuwo', 'swallow'];
    if (swallowKeywords.some(kw => itemName.includes(kw))) {
      modifierIds.push(soupChoice._id as mongoose.Types.ObjectId);
      addOnIds.push(extraSwallow._id as mongoose.Types.ObjectId);
    }

    const riceKeywords = ['rice', 'jollof', 'fried rice', 'beans', 'porridge', 'pasta', 'spaghetti'];
    if (riceKeywords.some(kw => itemName.includes(kw))) {
      addOnIds.push(extraPortion._id as mongoose.Types.ObjectId);
    }

    addOnIds.push(proteinChoice._id as mongoose.Types.ObjectId);
    addOnIds.push(drinkChoice._id as mongoose.Types.ObjectId);

    await MenuItem.updateOne(
      { _id: item._id },
      { $set: { modifiers: modifierIds, addOns: addOnIds } }
    );
    console.log(`  Updated "${item.name}": added ${modifierIds.length} modifiers, ${addOnIds.length} add-ons`);
  }

  await mongoose.disconnect();
}

main().catch(console.error);
