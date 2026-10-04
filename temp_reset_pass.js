const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr";

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to DB");
  
  const db = mongoose.connection.db;
  const usersCollection = db.collection('users');
  
  const user = await usersCollection.findOne({ email: 'oyeleyesalam@gmail.com' });
  if (!user) {
    console.log("User not found");
    process.exit(1);
  }
  
  console.log("Found user:", user.email);
  
  const tempPassword = 'password123';
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(tempPassword, salt);
  
  console.log("OLD HASH WAS:", user.password);
  
  await usersCollection.updateOne({ _id: user._id }, { $set: { password: hash } });
  
  console.log("Password updated to:", tempPassword);
  process.exit(0);
}

main().catch(console.error);
