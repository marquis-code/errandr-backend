const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function setPassword() {
  await mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr');
  console.log('Connected to DB');

  const db = mongoose.connection.db;
  const newPassword = await bcrypt.hash('password123', 12);

  const result = await db.collection('users').updateOne(
    { email: 'vinex67576@suahi.com' },
    { $set: { password: newPassword } }
  );

  console.log('Password updated, modified count:', result.modifiedCount);
  await mongoose.disconnect();
}

setPassword().catch(console.error);
