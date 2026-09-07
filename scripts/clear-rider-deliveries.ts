import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from the .env file in the current directory (backend)
dotenv.config({ path: path.join(__dirname, '../.env') });

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
    
    const db = mongoose.connection.db!;
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

    // 2. Identify active order statuses (everything except delivered, cancelled, refunded)
    const activeStatuses = ['confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'in_transit'];

    // 3. Update orders assigned to this rider that are still active
    const result = await ordersCollection.updateMany(
      { 
        errander: riderId,
        status: { $in: activeStatuses }
      },
      { 
        $set: { 
          status: 'cancelled',
          errander: null, // Clear the assignment
          cancelReason: 'Administrative cleanup of active deliveries'
        } 
      }
    );

    console.log(`🚀 Successfully cleared ${result.modifiedCount} active deliveries for ${RIDER_EMAIL}.`);

  } catch (error) {
    console.error('❌ An error occurred:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

main().catch(console.error);
