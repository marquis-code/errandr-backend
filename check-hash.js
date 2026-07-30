const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function check() {
  await mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr');
  const user = await mongoose.connection.collection('users').find({}).sort({ updatedAt: -1 }).limit(1).toArray();
  if (user.length > 0) {
    console.log('User found: ' + user[0].email);
    console.log('Hash length:', user[0].password ? user[0].password.length : 0);
    console.log('Hash starts with:', user[0].password ? user[0].password.substring(0, 10) : 'none');
  } else {
    console.log('No user');
  }
  process.exit(0);
}
check();
