import * as mongoose from 'mongoose';
import * as fs from 'fs';

async function check() {
  const uri = fs.readFileSync('scratch/uri.txt', 'utf8').trim().replace(/^"|"$/g, '');
  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db!;
    
    // Find User Halima
    const user = await db.collection('users').findOne({ firstName: /halima/i, lastName: /onitiju/i });
    if (!user) {
      console.log('User Halima Onitiju not found!');
      return;
    }
    console.log(`User found: ${user.firstName} ${user.lastName} (ID: ${user._id})`);
    
    // Find any order associated with this user
    console.log("Checking for ANY orders with this errander ID...");
    const ordersByErranderField = await db.collection('orders').find({ errander: user._id }).toArray();
    console.log(`Found ${ordersByErranderField.length} orders with errander field = ${user._id}`);
    
    for (const o of ordersByErranderField.slice(0, 5)) {
        console.log(`- Order ${o._id}: status=${o.status}, deliveryFee=${o.deliveryFee}`);
    }

    // Maybe the errander is an ObjectId reference, let's check string vs ObjectId
    const objectId = new mongoose.Types.ObjectId(user._id.toString());
    const stringId = user._id.toString();
    
    const ordersByObjectId = await db.collection('orders').find({ errander: objectId }).toArray();
    console.log(`Found ${ordersByObjectId.length} orders with errander field = ObjectId(${objectId})`);

    const ordersByStringId = await db.collection('orders').find({ errander: stringId }).toArray();
    console.log(`Found ${ordersByStringId.length} orders with errander field = "${stringId}"`);
    
    // Let's also check the most recent orders globally to see the schema
    console.log("\nChecking the 5 most recent orders globally to understand the schema...");
    const recentOrders = await db.collection('orders').find().sort({ createdAt: -1 }).limit(5).toArray();
    for (const o of recentOrders) {
        console.log(`- Order ${o._id}: errander=${o.errander} (${typeof o.errander}), status=${o.status}`);
    }

  } finally {
    await mongoose.disconnect();
  }
}

check().catch(console.error);
