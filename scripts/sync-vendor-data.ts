import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/erranders';

/**
 * MIGRATION SCRIPT: Sync Vendor IDs
 * 
 * This script addresses the mismatch where Orders/Products are linked to an old Vendor ID,
 * or where a Vendor's owner ID needs to be updated to match the current logged-in user.
 */

async function run() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(uri);
    console.log('Connected successfully.');
    
    const db = mongoose.connection.db;
    if (!db) {
        throw new Error('Database connection failed');
    }
    
    const vendorsColl = db.collection('vendors');
    const ordersColl = db.collection('orders');
    const productsColl = db.collection('products');

    // CONFIGURATION: Update these IDs based on your findings
    const CORRECT_VENDOR_ID = '69bed22dce3c828e98beb441'; // The ID from "fetch all vendors"
    const CURRENT_USER_ID = '69bf1c257bd24adc3fce8fab';   // The user currently logged in (from logs)
    
    // 1. Ensure the Vendor is owned by the correct user
    console.log(`Checking vendor ${CORRECT_VENDOR_ID}...`);
    const vendor = await vendorsColl.findOne({ _id: new mongoose.Types.ObjectId(CORRECT_VENDOR_ID) });
    
    if (!vendor) {
      console.error(`ERROR: Vendor with ID ${CORRECT_VENDOR_ID} not found!`);
      return;
    }

    console.log(`Found vendor: ${vendor.storeName}`);
    
    if (vendor.owner.toString() !== CURRENT_USER_ID) {
      console.log(`Updating vendor owner from ${vendor.owner} to ${CURRENT_USER_ID}...`);
      await vendorsColl.updateOne(
        { _id: new mongoose.Types.ObjectId(CORRECT_VENDOR_ID) },
        { $set: { owner: new mongoose.Types.ObjectId(CURRENT_USER_ID) } }
      );
    } else {
      console.log(`Vendor owner is already correct (${CURRENT_USER_ID}).`);
    }

    // 2. Find and update any orders/products that might be using a DIFFERENT vendor ID 
    // but should belong to this store name or owner.
    const OLD_VENDOR_ID = '69bf1c267bd24adc3fce8fae'; // From your "0 orders" logs

    if (OLD_VENDOR_ID) {
      console.log(`Migrating orders from ${OLD_VENDOR_ID} to ${CORRECT_VENDOR_ID}...`);
      const orderUpdate = await ordersColl.updateMany(
        { vendor: new mongoose.Types.ObjectId(OLD_VENDOR_ID) },
        { $set: { vendor: new mongoose.Types.ObjectId(CORRECT_VENDOR_ID) } }
      );
      console.log(`Updated ${orderUpdate.modifiedCount} orders.`);

      console.log(`Migrating products from ${OLD_VENDOR_ID} to ${CORRECT_VENDOR_ID}...`);
      const productUpdate = await productsColl.updateMany(
        { vendor: new mongoose.Types.ObjectId(OLD_VENDOR_ID) },
        { $set: { vendor: new mongoose.Types.ObjectId(CORRECT_VENDOR_ID) } }
      );
      console.log(`Updated ${productUpdate.modifiedCount} products.`);
    }

    console.log('Migration complete!');

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

run();
