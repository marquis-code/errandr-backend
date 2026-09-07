const mongoose = require('mongoose');
require('dotenv').config();

const clearDatabase = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.');

    const db = mongoose.connection.db;

    // List of collections to drop
    const collectionsToClear = [
      'users',
      'vendors',
      'erranders',
      'wallets',      // Clear wallets since they are tied to users
      'transactions', // Clear transactions as well
      'orders',       // Clear orders tied to users/vendors
      'chatmessages', // Clear chats
      'quests',       // Clear quests
      'userquests',   // Clear user quests
      'grouporders',  // Clear group orders
      'reports',      // Clear reports
      'favorites',    // Clear favorites
      'productcategories', // Clear product categories (optional, you can comment this out if you want to keep them)
      'products',      // Clear products (optional, you can comment this out if you want to keep them)
    ];

    console.log('\nStarting database cleanup...\n');

    for (const collectionName of collectionsToClear) {
      try {
        console.log(`Attempting to drop collection: ${collectionName}...`);
        await db.dropCollection(collectionName);
        console.log(`✅ Successfully dropped collection: ${collectionName}`);
      } catch (error) {
        if (error.code === 26) {
          console.log(`⚠️ Collection ${collectionName} does not exist (skipping).`);
        } else {
          console.error(`❌ Error dropping collection ${collectionName}:`, error.message);
        }
      }
    }

    console.log('\n🎉 Database cleanup complete!');
  } catch (error) {
    console.error('Error connecting to or clearing the database:', error);
  } finally {
    console.log('Closing MongoDB connection...');
    await mongoose.disconnect();
    console.log('Connection closed. Exiting.');
    process.exit(0);
  }
};

clearDatabase();
