const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/erranders');
  console.log('Connected to DB');

  const result = await mongoose.connection.collection('vendors').updateMany(
    {}, 
    { $set: { isOpen: true, isOnline: true } }
  );

  console.log(`Successfully updated ${result.modifiedCount} vendors to open/online status.`);
  
  await mongoose.disconnect();
  console.log('Disconnected from DB');
}

run().catch(console.error);
