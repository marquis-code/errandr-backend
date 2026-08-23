const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  const uri = process.env.MONGODB_URI;
  try {
    await mongoose.connect(uri);
    
    // Test Order findById
    const orderId = '6a889d7d00f8d41dd732e7cb';
    console.log(`\n--- Testing Order ${orderId} ---`);
    if (mongoose.isValidObjectId(orderId)) {
        const order = await mongoose.connection.collection('orders').findOne({ _id: new mongoose.Types.ObjectId(orderId) });
        console.log(order ? "Order found" : "Order not found");
        console.log(order);
    } else {
        console.log("Invalid ObjectId");
    }

    // Get a random errander user id to test with
    const errander = await mongoose.connection.collection('erranders').findOne({});
    if (errander) {
        console.log(`\n--- Testing Erranders me & earnings for user ${errander.user} ---`);
        const user = await mongoose.connection.collection('users').findOne({ _id: errander.user });
        console.log("Errander Details:", errander);
        console.log("User Details:", user);
    } else {
        console.log("No erranders found in DB");
    }

  } finally {
    await mongoose.disconnect();
  }
}

run().catch(console.dir);
