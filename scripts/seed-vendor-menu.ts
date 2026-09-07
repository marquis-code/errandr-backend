import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MenuCategory } from '../src/modules/menu/schemas/menu-category.schema';
import { MenuItem } from '../src/modules/menu/schemas/menu-item.schema';
import { MenuPack } from '../src/modules/menu/schemas/menu-pack.schema';
import { AddOnGroup } from '../src/modules/menu/schemas/add-on.schema';
import { Vendor } from '../src/modules/vendors/schemas/vendor.schema';

async function seed() {
  console.log('Bootstrapping app context...');
  const app = await NestFactory.createApplicationContext(AppModule);

  const CategoryModel = app.get<Model<MenuCategory>>(getModelToken(MenuCategory.name));
  const ItemModel = app.get<Model<MenuItem>>(getModelToken(MenuItem.name));
  const PackModel = app.get<Model<MenuPack>>(getModelToken(MenuPack.name));
  const AddOnGroupModel = app.get<Model<AddOnGroup>>(getModelToken(AddOnGroup.name));
  const VendorModel = app.get<Model<Vendor>>(getModelToken(Vendor.name));

  console.log('Clearing old menu data...');
  await CategoryModel.deleteMany({});
  await ItemModel.deleteMany({});
  await PackModel.deleteMany({});
  await AddOnGroupModel.deleteMany({});

  console.log('Looking for a food vendor to seed...');
  let vendor = await VendorModel.findOne({ category: 'Food' });
  
  if (!vendor) {
    console.log('No food vendor found. Creating Iya Basira Kitchen...');
    // Create a dummy vendor if none exists just so we have one
    const ownerId = new Types.ObjectId();
    vendor = await VendorModel.create({
      storeName: 'Iya Basira Kitchen',
      category: 'Food',
      owner: ownerId,
      description: 'The best local food on campus',
      businessAddress: 'Campus gate',
      contactPhone: '08000000000',
      isActive: true,
      hasCompletedSetup: true,
      isVerified: true
    });
  }
  
  const VENDOR_ID = vendor._id;
  console.log(`Seeding menu for vendor: ${vendor.storeName} (${VENDOR_ID})`);

  // ---- 1. Categories ----
  const [riceCategory, swallowCategory, drinksCategory, comboCategory] =
    await CategoryModel.insertMany([
      { name: 'Rice Dishes', vendorId: VENDOR_ID, sortOrder: 1 },
      { name: 'Swallow & Soups', vendorId: VENDOR_ID, sortOrder: 2 },
      { name: 'Drinks', vendorId: VENDOR_ID, sortOrder: 3 },
      { name: 'Combo Packs', vendorId: VENDOR_ID, sortOrder: 4 },
    ]);

  // ---- 2. Reusable AddOnGroups (shared across items & packs) ----
  const [extraProteinGroup, extraSidesGroup] = await AddOnGroupModel.insertMany([
    {
      name: 'Extra Protein',
      selectionType: 'multi',
      minSelect: 0,
      maxSelect: null,
      vendorId: VENDOR_ID,
      options: [
        { name: 'Extra Chicken', price: 1500 },
        { name: 'Extra Beef', price: 1000 },
        { name: 'Extra Fish', price: 1500 },
        { name: 'Extra Egg', price: 300 },
      ],
    },
    {
      name: 'Extra Sides',
      selectionType: 'multi',
      minSelect: 0,
      maxSelect: 3,
      vendorId: VENDOR_ID,
      options: [
        { name: 'Extra Plantain', price: 700 },
        { name: 'Extra Moi Moi', price: 800 },
        { name: 'Extra Coleslaw', price: 500 },
      ],
    },
  ]);

  // ---- 3. Items — PER PORTION pricing, no bundling here ----
  const [friedRice, jollofRice, ofadaRice, ebaEgusi, amalaGbegiri, zobo, chapman] =
    await ItemModel.insertMany([
      {
        name: 'Fried Rice',
        categoryId: riceCategory._id,
        vendorId: VENDOR_ID,
        pricePerPortion: 2500,
        portionUnit: 'plate',
        prepTimeMinutes: 20,
        modifiers: [
          {
            name: 'Spice Level',
            isRequired: true,
            options: [
              { name: 'Mild', priceDelta: 0 },
              { name: 'Hot', priceDelta: 0 },
              { name: 'Extra Hot', priceDelta: 0 },
            ],
          },
        ],
        addOnGroupIds: [extraProteinGroup._id, extraSidesGroup._id],
      },
      {
        name: 'Jollof Rice',
        categoryId: riceCategory._id,
        vendorId: VENDOR_ID,
        pricePerPortion: 2500,
        portionUnit: 'plate',
        prepTimeMinutes: 20,
        modifiers: [
          {
            name: 'Spice Level',
            isRequired: true,
            options: [
              { name: 'Mild', priceDelta: 0 },
              { name: 'Hot', priceDelta: 0 },
              { name: 'Extra Hot', priceDelta: 0 },
            ],
          },
        ],
        addOnGroupIds: [extraProteinGroup._id, extraSidesGroup._id],
      },
      {
        name: 'Ofada Rice + Ayamase Sauce',
        categoryId: riceCategory._id,
        vendorId: VENDOR_ID,
        pricePerPortion: 3200,
        portionUnit: 'plate',
        prepTimeMinutes: 25,
        addOnGroupIds: [extraProteinGroup._id],
      },
      {
        name: 'Eba + Egusi Soup',
        categoryId: swallowCategory._id,
        vendorId: VENDOR_ID,
        pricePerPortion: 3000,
        portionUnit: 'wrap',
        prepTimeMinutes: 20,
        modifiers: [
          {
            name: 'Swallow Size',
            isRequired: true,
            options: [
              { name: 'Small', priceDelta: 0 },
              { name: 'Medium', priceDelta: 300 },
              { name: 'Large', priceDelta: 600 },
            ],
          },
        ],
        addOnGroupIds: [extraProteinGroup._id],
      },
      {
        name: 'Amala + Gbegiri + Ewedu',
        categoryId: swallowCategory._id,
        vendorId: VENDOR_ID,
        pricePerPortion: 3200,
        portionUnit: 'wrap',
        prepTimeMinutes: 20,
        modifiers: [
          {
            name: 'Swallow Size',
            isRequired: true,
            options: [
              { name: 'Small', priceDelta: 0 },
              { name: 'Medium', priceDelta: 300 },
              { name: 'Large', priceDelta: 600 },
            ],
          },
        ],
        addOnGroupIds: [extraProteinGroup._id],
      },
      {
        name: 'Zobo (500ml)',
        categoryId: drinksCategory._id,
        vendorId: VENDOR_ID,
        pricePerPortion: 700,
        portionUnit: 'bottle',
        prepTimeMinutes: 2,
      },
      {
        name: 'Chapman (500ml)',
        categoryId: drinksCategory._id,
        vendorId: VENDOR_ID,
        pricePerPortion: 1000,
        portionUnit: 'bottle',
        prepTimeMinutes: 2,
      },
    ]);

  // ---- 4. Packs — FIXED bundle price, independent of item prices ----
  await PackModel.insertMany([
    {
      name: 'Student Special',
      description: '2 plates Fried Rice + Zobo — bundle discount vs à la carte',
      categoryId: comboCategory._id,
      vendorId: VENDOR_ID,
      components: [
        { itemId: friedRice._id, portions: 2 }, // would be ₦5,000 à la carte
        { itemId: zobo._id, portions: 1 }, //        + ₦700 à la carte
      ],
      bundlePrice: 5200, // vendor-set fixed price, NOT 5,700 sum — still a saving
      addOnGroupIds: [extraProteinGroup._id, extraSidesGroup._id], // can still add extras
    },
    {
      name: 'Swallow Combo',
      description: 'Eba + Egusi with Amala on the side, Chapman included',
      categoryId: comboCategory._id,
      vendorId: VENDOR_ID,
      components: [
        { itemId: ebaEgusi._id, portions: 1 },
        { itemId: amalaGbegiri._id, portions: 1 },
        { itemId: chapman._id, portions: 1 },
      ],
      bundlePrice: 6500,
      addOnGroupIds: [extraProteinGroup._id],
    },
  ]);

  console.log('Seed complete! Application context closing...');
  await app.close();
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
