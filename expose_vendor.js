const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function run() {
  await mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr');

  // 1. Find a vendor profile
  const Vendor = mongoose.connection.collection('vendors');
  const User = mongoose.connection.collection('users');

  const vendor = await Vendor.findOne({ isStudentBusiness: true }); // Prefer a student business (hybrid)
  const targetVendor = vendor || await Vendor.findOne({});

  if (!targetVendor) {
    console.log("No vendor found");
    process.exit(1);
  }

  // 2. Find the user associated with this vendor
  const user = await User.findOne({ _id: targetVendor.owner });
  if (!user) {
    console.log("No user found for vendor owner:", targetVendor.owner);
    process.exit(1);
  }

  // 3. Reset the password
  const newPassword = 'password123';
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  
  await User.updateOne({ _id: user._id }, { $set: { password: hashedPassword } });

  console.log("Store Name:", targetVendor.storeName);
  console.log("Email:", user.email);
  console.log("Password:", newPassword);

  process.exit(0);
}

run().catch(console.error);
