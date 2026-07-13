const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/.env' });

const vendorId = new mongoose.Types.ObjectId('6a543ba505a7398e4bea68c3');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  
  // 1. Remove previous mistakenly seeded products
  await db.collection('products').deleteMany({ vendor: vendorId });
  await db.collection('menuitems').deleteMany({ vendor: vendorId });
  await db.collection('modifiers').deleteMany({ vendor: vendorId });
  await db.collection('addons').deleteMany({ vendor: vendorId });

  // 2. Create Modifiers
  const meatDoneness = await db.collection('modifiers').insertOne({
    vendor: vendorId,
    name: "Meat Doneness",
    optionGroup: "Required",
    minSelection: 1,
    maxSelection: 1,
    publishNow: true,
    items: [
      { name: "Medium Rare", price: 0 },
      { name: "Medium", price: 0 },
      { name: "Well Done", price: 0 }
    ],
    createdAt: new Date(), updatedAt: new Date()
  });

  const cheese = await db.collection('modifiers').insertOne({
    vendor: vendorId,
    name: "Choose Your Cheese",
    optionGroup: "Required",
    minSelection: 1,
    maxSelection: 1,
    publishNow: true,
    items: [
      { name: "Cheddar", price: 0 },
      { name: "Swiss", price: 200 }
    ],
    createdAt: new Date(), updatedAt: new Date()
  });

  const proteins = await db.collection('modifiers').insertOne({
    vendor: vendorId,
    name: "Select Primary Protein",
    optionGroup: "Required",
    minSelection: 1,
    maxSelection: 1,
    publishNow: true,
    items: [
      { name: "Grilled Chicken", price: 0 },
      { name: "Fried Turkey", price: 1000 },
      { name: "Fried Beef", price: 500 }
    ],
    createdAt: new Date(), updatedAt: new Date()
  });

  const eggStyle = await db.collection('modifiers').insertOne({
    vendor: vendorId,
    name: "Egg Style",
    optionGroup: "Required",
    minSelection: 1,
    maxSelection: 1,
    publishNow: true,
    items: [
      { name: "Sunny Side Up", price: 0 },
      { name: "Scrambled", price: 0 }
    ],
    createdAt: new Date(), updatedAt: new Date()
  });

  // 3. Create Add-ons
  const extraSides = await db.collection('addons').insertOne({
    vendor: vendorId,
    name: "Extra Sides",
    optionGroup: "Optional",
    minSelection: 0,
    maxSelection: 3,
    publishNow: true,
    items: [
      { name: "Extra Fries", price: 1000 },
      { name: "Coleslaw", price: 800 }
    ],
    createdAt: new Date(), updatedAt: new Date()
  });

  const drinks = await db.collection('addons').insertOne({
    vendor: vendorId,
    name: "Drinks",
    optionGroup: "Optional",
    minSelection: 0,
    maxSelection: 2,
    publishNow: true,
    items: [
      { name: "Coke", price: 500 },
      { name: "Water", price: 300 }
    ],
    createdAt: new Date(), updatedAt: new Date()
  });

  // 4. Create Menu Items
  const menuItems = [
    {
      vendor: vendorId,
      name: "Ultimate Burger Combo",
      description: "Our signature beef burger served with fries and a drink.",
      price: 4500,
      costPrice: 2000,
      publishItem: true, // required by filter
      isAvailable: true,
      trackStock: true,
      inStock: 50,
      sku: "B-ULT-COMBO",
      imageUrl: "https://res.cloudinary.com/dfpabtrke/image/upload/v1783410937/erranders/g5oumv3vloywbv2xwqsl.jpg",
      tags: ["Meat", "Lunch", "Snacks"],
      modifiers: [meatDoneness.insertedId, cheese.insertedId],
      addOns: [extraSides.insertedId, drinks.insertedId],
      variations: [
        { name: "Single Patty", costPrice: 2000, price: 4500, sku: "B-ULT-SGL", stock: 25 },
        { name: "Double Patty", costPrice: 3000, price: 6000, sku: "B-ULT-DBL", stock: 25 }
      ],
      createdAt: new Date(), updatedAt: new Date(), __v: 0
    },
    {
      vendor: vendorId,
      name: "Festive Jollof Rice",
      description: "Authentic Nigerian party Jollof rice.",
      price: 3500,
      costPrice: 1500,
      publishItem: true,
      isAvailable: true,
      trackStock: true,
      inStock: 100,
      sku: "R-JOL-FEST",
      imageUrl: "https://res.cloudinary.com/dfpabtrke/image/upload/v1783417841/erranders/cfkop0ofdrjxiu8jl0yf.jpg",
      tags: ["African", "Rice", "Lunch"],
      modifiers: [proteins.insertedId],
      addOns: [extraSides.insertedId, drinks.insertedId],
      variations: [
        { name: "Regular Portion", costPrice: 1500, price: 3500, sku: "R-JOL-REG", stock: 50 },
        { name: "Family Pack", costPrice: 6000, price: 15000, sku: "R-JOL-FAM", stock: 20 }
      ],
      createdAt: new Date(), updatedAt: new Date(), __v: 0
    },
    {
      vendor: vendorId,
      name: "Full English Breakfast",
      description: "Hearty breakfast featuring eggs, sausages, baked beans, toast.",
      price: 5500,
      costPrice: 2500,
      publishItem: true,
      isAvailable: true,
      trackStock: true,
      inStock: 30,
      sku: "B-FULL-ENG",
      imageUrl: "https://res.cloudinary.com/dfpabtrke/image/upload/v1783444434/erranders/dt0k9a9njoy44flib2x0.jpg",
      tags: ["Breakfast", "Meat"],
      modifiers: [eggStyle.insertedId],
      addOns: [drinks.insertedId],
      variations: [
        { name: "Standard", costPrice: 2500, price: 5500, sku: "B-ENG-STD", stock: 20 },
        { name: "Deluxe", costPrice: 3500, price: 7500, sku: "B-ENG-DLX", stock: 10 }
      ],
      createdAt: new Date(), updatedAt: new Date(), __v: 0
    }
  ];

  const result = await db.collection('menuitems').insertMany(menuItems);
  console.log(`Successfully seeded ${result.insertedCount} complicated menu items for vendor ${vendorId}`);
  
  await mongoose.disconnect();
}
main().catch(console.error);
