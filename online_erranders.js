const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/erranders');
  console.log('Connected to DB');

  const result = await mongoose.connection.collection('erranders').updateMany(
    {}, 
    { $set: { status: 'available' } }
  );

  console.log(`Successfully updated ${result.modifiedCount} erranders to online (available) status.`);
  
  await mongoose.disconnect();
  console.log('Disconnected from DB');
}

run().catch(console.error);
