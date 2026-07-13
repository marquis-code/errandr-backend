const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/.env' });

const vendorId = new mongoose.Types.ObjectId('6a543ba505a7398e4bea68c3');

const seedProducts = [
  {
    vendor: vendorId,
    name: "Ultimate Burger Combo",
    description: "Our signature beef burger served with fries and a drink. Customize to your taste!",
    price: 4500,
    costPrice: 2000,
    discountPrice: 0,
    category: "Burgers",
    servingSize: "1 plate",
    portionInfo: "Standard",
    preparationTime: 20,
    trackStock: true,
    stockQuantity: 50,
    sku: "B-ULT-COMBO",
    minOrderQty: 1,
    maxOrderQty: 10,
    isAvailable: true,
    isFeatured: true,
    image: "https://res.cloudinary.com/dfpabtrke/image/upload/v1783410937/erranders/g5oumv3vloywbv2xwqsl.jpg", // placeholder
    images: ["https://res.cloudinary.com/dfpabtrke/image/upload/v1783410937/erranders/g5oumv3vloywbv2xwqsl.jpg"],
    tags: ["Meat", "Lunch", "Snacks"],
    packs: ["Take-away box"],
    variations: [
      { name: "Single Patty", costPrice: 2000, price: 4500, sku: "B-ULT-SGL", stock: 25 },
      { name: "Double Patty", costPrice: 3000, price: 6000, sku: "B-ULT-DBL", stock: 25 }
    ],
    modifiers: [
      {
        name: "Meat Doneness",
        minSelection: 1,
        maxSelection: 1,
        items: [
          { name: "Medium Rare", price: 0 },
          { name: "Medium", price: 0 },
          { name: "Medium Well", price: 0 },
          { name: "Well Done", price: 0 }
        ]
      },
      {
        name: "Choose Your Cheese",
        minSelection: 1,
        maxSelection: 1,
        items: [
          { name: "Cheddar", price: 0 },
          { name: "Swiss", price: 200 },
          { name: "Pepper Jack", price: 200 }
        ]
      }
    ],
    addOns: [
      {
        name: "Extra Sides",
        minSelection: 0,
        maxSelection: 3,
        items: [
          { name: "Extra Fries", price: 1000 },
          { name: "Onion Rings", price: 1500 },
          { name: "Coleslaw", price: 800 }
        ]
      },
      {
        name: "Drinks",
        minSelection: 0,
        maxSelection: 2,
        items: [
          { name: "Coke", price: 500 },
          { name: "Fanta", price: 500 },
          { name: "Water", price: 300 }
        ]
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    __v: 0
  },
  {
    vendor: vendorId,
    name: "Festive Jollof Rice",
    description: "Authentic Nigerian party Jollof rice, served with your choice of protein and sides.",
    price: 3500,
    costPrice: 1500,
    discountPrice: 0,
    category: "Rice",
    servingSize: "1 plate",
    portionInfo: "Generous",
    preparationTime: 15,
    trackStock: true,
    stockQuantity: 100,
    sku: "R-JOL-FEST",
    minOrderQty: 1,
    maxOrderQty: 20,
    isAvailable: true,
    isFeatured: true,
    image: "https://res.cloudinary.com/dfpabtrke/image/upload/v1783417841/erranders/cfkop0ofdrjxiu8jl0yf.jpg", // placeholder
    images: ["https://res.cloudinary.com/dfpabtrke/image/upload/v1783417841/erranders/cfkop0ofdrjxiu8jl0yf.jpg"],
    tags: ["African", "Rice", "Lunch"],
    packs: ["Take-away box", "Family pack"],
    variations: [
      { name: "Regular Portion", costPrice: 1500, price: 3500, sku: "R-JOL-REG", stock: 50 },
      { name: "Large Portion", costPrice: 2000, price: 5000, sku: "R-JOL-LRG", stock: 30 },
      { name: "Family Pack (4 pax)", costPrice: 6000, price: 15000, sku: "R-JOL-FAM", stock: 20 }
    ],
    modifiers: [
      {
        name: "Select Primary Protein",
        minSelection: 1,
        maxSelection: 1,
        items: [
          { name: "Grilled Chicken", price: 0 },
          { name: "Fried Turkey", price: 1000 },
          { name: "Fried Beef", price: 500 },
          { name: "Grilled Fish (Croaker)", price: 1500 }
        ]
      }
    ],
    addOns: [
      {
        name: "Extra Proteins",
        minSelection: 0,
        maxSelection: 5,
        items: [
          { name: "Extra Chicken", price: 1500 },
          { name: "Extra Turkey", price: 2500 },
          { name: "Extra Beef", price: 1000 },
          { name: "Boiled Egg", price: 300 }
        ]
      },
      {
        name: "Sides",
        minSelection: 0,
        maxSelection: 3,
        items: [
          { name: "Fried Plantain (Dodo)", price: 500 },
          { name: "Moi-Moi", price: 800 },
          { name: "Coleslaw", price: 500 }
        ]
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    __v: 0
  },
  {
    vendor: vendorId,
    name: "Full English Breakfast",
    description: "A hearty breakfast featuring eggs, sausages, baked beans, toast, and grilled tomatoes.",
    price: 5500,
    costPrice: 2500,
    discountPrice: 0,
    category: "Breakfast",
    servingSize: "1 plate",
    portionInfo: "Large",
    preparationTime: 25,
    trackStock: true,
    stockQuantity: 30,
    sku: "B-FULL-ENG",
    minOrderQty: 1,
    maxOrderQty: 5,
    isAvailable: true,
    isFeatured: false,
    image: "https://res.cloudinary.com/dfpabtrke/image/upload/v1783444434/erranders/dt0k9a9njoy44flib2x0.jpg", // placeholder
    images: ["https://res.cloudinary.com/dfpabtrke/image/upload/v1783444434/erranders/dt0k9a9njoy44flib2x0.jpg"],
    tags: ["Breakfast", "Meat"],
    packs: ["Take-away box"],
    variations: [
      { name: "Standard Setup", costPrice: 2500, price: 5500, sku: "B-ENG-STD", stock: 20 },
      { name: "Deluxe (Extra Bacon & Mushrooms)", costPrice: 3500, price: 7500, sku: "B-ENG-DLX", stock: 10 }
    ],
    modifiers: [
      {
        name: "Egg Style",
        minSelection: 1,
        maxSelection: 1,
        items: [
          { name: "Sunny Side Up", price: 0 },
          { name: "Scrambled", price: 0 },
          { name: "Over Easy", price: 0 },
          { name: "Boiled", price: 0 }
        ]
      },
      {
        name: "Bread Choice",
        minSelection: 1,
        maxSelection: 1,
        items: [
          { name: "White Toast", price: 0 },
          { name: "Wheat Toast", price: 0 },
          { name: "Sourdough", price: 500 }
        ]
      }
    ],
    addOns: [
      {
        name: "Extra Breakfast Items",
        minSelection: 0,
        maxSelection: 4,
        items: [
          { name: "Extra Sausage", price: 800 },
          { name: "Extra Bacon", price: 1000 },
          { name: "Extra Egg", price: 300 },
          { name: "Hash Browns", price: 1200 }
        ]
      },
      {
        name: "Hot Drinks",
        minSelection: 0,
        maxSelection: 2,
        items: [
          { name: "Black Coffee", price: 1000 },
          { name: "Tea", price: 800 },
          { name: "Hot Chocolate", price: 1200 }
        ]
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    __v: 0
  }
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  
  const result = await db.collection('products').insertMany(seedProducts);
  console.log(`Successfully seeded ${result.insertedCount} complicated products for vendor ${vendorId}`);
  
  await mongoose.disconnect();
}
main().catch(console.error);
