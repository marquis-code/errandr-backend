const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Basic .env parser since dotenv might not be available
function loadEnv() {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const index = line.indexOf('=');
      if (index > -1) {
        const key = line.substring(0, index).trim();
        const value = line.substring(index + 1).trim().replace(/['"]/g, '');
        process.env[key] = value;
      }
    });
  }
}

loadEnv();

const MONGODB_URI = process.env.MONGODB_URI;
const RIDER_EMAIL = 'rider@erranders.org';

async function main() {
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not found in .env file');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected successfully to MongoDB');
    
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    const ordersCollection = db.collection('orders');

    // 1. Find the rider by email to get their _id
    const rider = await usersCollection.findOne({ email: RIDER_EMAIL });

    if (!rider) {
      console.error(`❌ User with email "${RIDER_EMAIL}" not found`);
      process.exit(1);
    }

    const riderId = rider._id;
    console.log(`👤 Found Rider: ${rider.firstName} ${rider.lastName} (ID: ${riderId})`);

    // 2. Clear the Errander Profile (this is what triggers the "Already have an active order" error)
    const errandersCollection = db.collection('erranders');
    const profileUpdate = await errandersCollection.updateOne(
      { user: riderId },
      { 
        $set: { 
          currentOrder: null,
          batchOrders: [],
          status: 'available' 
        } 
      }
    );
    console.log(`📋 Updated Errander Profile: ${profileUpdate.modifiedCount} profile(s) reset to available.`);

    // 3. Identify active order statuses
    const activeStatuses = ['confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'in_transit'];

    // 4. Update orders assigned to this rider that are still active
    const result = await ordersCollection.updateMany(
      { 
        errander: riderId,
        status: { $in: activeStatuses }
      },
      { 
        $set: { 
          status: 'cancelled',
          errander: null,
          cancelReason: 'Administrative cleanup of active deliveries'
        } 
      }
    );

    console.log(`🚀 Successfully cleared ${result.modifiedCount} active order documents for ${RIDER_EMAIL}.`);

  } catch (error) {
    console.error('❌ An error occurred:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

main().catch(console.error);
