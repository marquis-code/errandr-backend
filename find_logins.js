const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/.env' });

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  
  const storeNames = [/vouage/i, /voyage/i, /adewale/i];
  
  for (const name of storeNames) {
    const vendor = await db.collection('vendors').findOne({ storeName: name });
    if (!vendor) {
      continue;
    }
    
    // Vendor has an owner field which points to the user.
    if (!vendor.owner) {
       console.log(`Vendor ${vendor.storeName} has no owner field.`);
       continue;
    }
    
    // Look up the user by ID
    const user = await db.collection('users').findOne({ _id: vendor.owner });
    if (!user) {
        console.log(`Vendor: ${vendor.storeName}`);
        console.log(`Owner ID: ${vendor.owner}`);
        console.log(`Could not find a corresponding user in 'users' collection.`);
    } else {
        console.log(`Vendor: ${vendor.storeName}`);
        console.log(`Login Email: ${user.email}`);
        console.log(`Phone: ${user.phone}`);
    }
    console.log('----------------------------');
  }
  
  await mongoose.disconnect();
}

main().catch(console.error);
