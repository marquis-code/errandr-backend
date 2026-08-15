const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const users = mongoose.connection.collection('users');
  const user = await users.findOne({ email: 'pontisdor@gmail.com' });
  if (user) {
    console.log('User found:', user.email);
    console.log('Password hash:', user.password);
  } else {
    console.log('User not found');
  }
  process.exit(0);
}
run().catch(console.error);
