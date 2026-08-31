require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function resetPassword() {
  await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log("Connected to MongoDB");

  // We have to guess the model name, it's usually User in backend/src/models/User.js or similar
  const userSchema = new mongoose.Schema({ email: String, password: String }, { strict: false });
  const User = mongoose.model('User', userSchema, 'users'); 

  const email = 'abahmarquis@gmail.com';
  const newPassword = 'Password123!';
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  const result = await User.updateOne({ email }, { $set: { password: hashedPassword } });
  console.log("Update result:", result);
  
  mongoose.disconnect();
}

resetPassword().catch(console.error);
