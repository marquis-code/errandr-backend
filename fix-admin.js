const mongoose = require('mongoose');

async function fixUser() {
  await mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr');
  console.log('Connected to DB');

  const db = mongoose.connection.db;
  
  const result = await db.collection('users').updateOne(
    { email: 'admin@erranders.org' },
    { 
      $set: { isActive: true },
      $unset: { deletedAt: "", deletionReason: "" }
    }
  );

  console.log('Modified count:', result.modifiedCount);
  await mongoose.disconnect();
}

fixUser().catch(console.error);
