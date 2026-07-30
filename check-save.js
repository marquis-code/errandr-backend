const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { SchemaFactory, Schema, Prop } = require('@nestjs/mongoose');
const UserRole = { STUDENT: 'student', VENDOR: 'vendor' };

// Use a simple schema just to test save
const schema = new mongoose.Schema({
  email: String,
  password: String,
  resetPasswordOtp: String,
  resetPasswordOtpExpiry: Date
}, { strict: false });

async function check() {
  await mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr');
  const UserModel = mongoose.model('User', schema, 'users');
  
  const users = await UserModel.find({ email: 'abahmarquis@gmail.com' });
  console.log(`Found ${users.length} users`);
  for (const u of users) {
    try {
      console.log(`Testing save for user role: ${u.role}`);
      u.password = await bcrypt.hash('password123', 12);
      u.resetPasswordOtp = undefined;
      u.resetPasswordOtpExpiry = undefined;
      await u.save();
      console.log(`Save successful for ${u.role}`);
    } catch (e) {
      console.log(`Save failed for ${u.role}:`, e.message);
    }
  }
  process.exit(0);
}
check();
