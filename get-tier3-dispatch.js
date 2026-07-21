const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function getAnotherDispatch() {
  await mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr');
  console.log('Connected to DB');

  const db = mongoose.connection.db;

  // Find another errander, excluding the one we just used
  const errander = await db.collection('users').findOne({ 
    role: 'errander', 
    email: { $ne: 'abahmarquis@gmail.com' } 
  });

  if (errander) {
    console.log(`Found Errander: ${errander.email}`);
    const newPassword = await bcrypt.hash('password123', 12);

    await db.collection('users').updateOne(
      { _id: errander._id },
      { $set: { 
          'tier': 3, 
          'password': newPassword,
          'isActive': true,
          'isVerified': true
        } 
      }
    );

    const erranderProfile = await db.collection('erranders').findOne({ user: errander._id });
    if (erranderProfile) {
      await db.collection('erranders').updateOne(
        { _id: erranderProfile._id },
        { $set: { tier: 3 } }
      );
      console.log('Updated erranders collection profile to tier 3 too');
    }

    console.log(`Login Email: ${errander.email}`);
    console.log(`Password: password123`);
  } else {
    console.log('No other errander found in DB');
  }

  await mongoose.disconnect();
}

getAnotherDispatch().catch(console.error);
