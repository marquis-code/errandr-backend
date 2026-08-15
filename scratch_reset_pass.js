const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const users = mongoose.connection.collection('users');
  
  const newPassword = 'Password123!';
  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(newPassword, salt);
  
  await users.updateOne(
    { email: 'pontisdor@gmail.com' },
    { $set: { password: hashedPassword } }
  );
  
  console.log('Password reset successfully to:', newPassword);
  process.exit(0);
}
run().catch(console.error);
