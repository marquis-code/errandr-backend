const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Minimal schema to bypass strict mode but allow saving
const schema = new mongoose.Schema({
  email: String,
  password: String,
  resetPasswordOtp: String,
  resetPasswordOtpExpiry: Date
}, { strict: false });

async function test() {
  await mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr');
  const UserModel = mongoose.model('UserTest', schema, 'users');
  
  // Create dummy user
  const dummy = new UserModel({ email: 'testreset123@example.com', role: 'student', password: 'old' });
  await dummy.save();
  
  // Simulate reset
  const users = await UserModel.find({ email: 'testreset123@example.com' });
  const hashedPassword = await bcrypt.hash('newpassword123', 12);
  for (const u of users) {
    u.password = hashedPassword;
    u.resetPasswordOtp = undefined;
    u.resetPasswordOtpExpiry = undefined;
    await u.save();
  }
  
  // Simulate login
  const checkUser = await UserModel.findOne({ email: 'testreset123@example.com', role: 'student' });
  const isValid = await bcrypt.compare('newpassword123', checkUser.password);
  console.log('Test login successful:', isValid);
  
  // Cleanup
  await UserModel.deleteOne({ _id: checkUser._id });
  process.exit(0);
}
test();
