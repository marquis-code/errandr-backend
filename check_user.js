require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function checkUser() {
  await mongoose.connect(process.env.MONGODB_URI);
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users'); 
  const user = await User.findOne({ email: 'abahmarquis@gmail.com' });
  console.log("User found:", user);
  if (user && user.password) {
    const isMatch = await bcrypt.compare('Password123!', user.password);
    console.log("Password match with 'Password123!':", isMatch);
  }
  mongoose.disconnect();
}

checkUser().catch(console.error);
