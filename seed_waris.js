const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const vendor = await mongoose.connection.collection('vendors').findOne({
    storeName: { $regex: /waris/i }
  });

  if (!vendor) {
    console.log('Vendor Waris Kitchen not found');
    process.exit(1);
  }

  const items = [
    // Food
    { name: 'White rice', price: 200, category: 'Food' },
    { name: 'Fried and Jollof', price: 200, category: 'Food' },
    { name: 'Beef', price: 200, category: 'Food' },
    { name: 'Inu eran', price: 200, category: 'Food' },
    { name: 'Plantain', price: 200, category: 'Food' },
    { name: 'Goat meat', price: 1000, category: 'Food' },
    { name: 'Fish (Small)', price: 1200, category: 'Food' },
    { name: 'Fish (Large)', price: 2000, category: 'Food' },
    { name: 'Moi moi', price: 500, category: 'Food' },
    { name: 'Coleslaw', price: 200, category: 'Food' },

    // Swallow
    { name: 'Fufu', price: 300, category: 'Swallow' }, 
    { name: 'Eba', price: 200, category: 'Swallow' },
    { name: 'Amala', price: 200, category: 'Swallow' },
    { name: 'Semo', price: 300, category: 'Swallow' },
    { name: 'Poundo', price: 300, category: 'Swallow' },

    // Soup option
    { name: 'Vegetable Soup', price: 0, category: 'Soups' },
    { name: 'Egusi Soup', price: 0, category: 'Soups' },
    { name: 'Ewedu Soup', price: 0, category: 'Soups' },

    // Drinks
    { name: 'Fanta', price: 500, category: 'Drinks' },
    { name: 'Coke', price: 500, category: 'Drinks' },
    { name: 'Pepsi', price: 500, category: 'Drinks' },
    { name: 'Malt', price: 1000, category: 'Drinks' },
    { name: 'Bottled water', price: 200, category: 'Drinks' },
    { name: 'Pulpy', price: 1500, category: 'Drinks' }
  ];

  for (const item of items) {
    await mongoose.connection.collection('products').insertOne({
      vendor: vendor._id,
      name: item.name,
      description: item.name,
      price: item.price,
      discountPrice: 0,
      discountPercentage: 0,
      image: '',
      images: [],
      videos: [],
      category: item.category,
      tags: [],
      isAvailable: true,
      isFeatured: false,
      isPinned: false,
      orderCount: 0,
      preparationTime: 10,
      servingSize: '1 portion',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  console.log(`Successfully inserted ${items.length} products for ${vendor.storeName}.`);
  await mongoose.disconnect();
}

run().catch(console.error);
