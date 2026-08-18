import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '.env') });

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('No URI');
  await mongoose.connect(uri);
  
  const db = mongoose.connection;
  const vendor = await db.collection('vendors').findOne({ storeName: { $regex: /Iyabo/i } });
  
  if (!vendor) {
    console.log('Vendor not found');
    process.exit(1);
  }
  
  console.log('Vendor found:', vendor.storeName);
  console.log('Phone number:', vendor.phone);
  
  // Find user to see if phone is there instead
  const user = await db.collection('users').findOne({ _id: vendor.user });
  if (user) {
      console.log('Vendor User Phone:', user.phone);
  }

  await mongoose.disconnect();
}

run().catch(console.error);
