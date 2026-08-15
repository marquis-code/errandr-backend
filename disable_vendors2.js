const mongoose = require('mongoose');

// Assuming dotenv is needed if uri is loaded from env
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/erranders');
  console.log('Connected to DB');

  const vendorNames = [
    'SMOOTHIEDADDI',
    'Starlings Services'
  ];

  for (const name of vendorNames) {
    const regex = new RegExp(name.replace('$', '\\$'), 'i'); 
    const result = await mongoose.connection.collection('vendors').updateMany(
      { storeName: regex },
      { $set: { isVisible: false } }
    );
    console.log(`Updated ${result.modifiedCount} vendors for "${name}"`);
  }

  // Find user by firstName (case-insensitive)
  const user = await mongoose.connection.collection('users').findOne({ 
    firstName: new RegExp('toweshodocas', 'i') 
  });

  if (user) {
    const result = await mongoose.connection.collection('vendors').updateMany(
      { owner: user._id },
      { $set: { isVisible: false } }
    );
    console.log(`Updated ${result.modifiedCount} vendors for user "toweshodocas"`);
  } else {
    console.log(`User "toweshodocas" not found in users collection.`);
    const result2 = await mongoose.connection.collection('vendors').updateMany(
      { $or: [
          { firstName: new RegExp('toweshodocas', 'i') },
          { 'contact.firstName': new RegExp('toweshodocas', 'i') }
      ] },
      { $set: { isVisible: false } }
    );
    console.log(`Updated ${result2.modifiedCount} vendors matching "toweshodocas" directly.`);
  }

  await mongoose.disconnect();
  console.log('Done');
}

run().catch(console.error);
