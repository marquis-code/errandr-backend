const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/erranders');
  console.log('Connected to DB');

  const email = 'hvipfoods@vendor.com';
  const password = 'HvipPassword123!';
  const hashedPassword = await bcrypt.hash(password, 10);

  // 1. Create User
  const userObj = {
    _id: new mongoose.Types.ObjectId(),
    firstName: 'HVIP',
    lastName: 'FOODS',
    email: email,
    password: hashedPassword,
    role: 'vendor',
    roles: ['vendor'],
    isVerified: true,
    phoneNumber: '08000000000',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await mongoose.connection.collection('users').insertOne(userObj);
  console.log(`Created user: ${email}`);

  // 2. Create Vendor
  const vendorObj = {
    _id: new mongoose.Types.ObjectId(),
    owner: userObj._id,
    storeName: 'HVIP FOODS',
    subdomain: 'hvipfoods',
    description: 'VIP Buka By HVIP FOODS. 🍽️ Dine in || 🥡 Take-out || 👨🏽‍🍳 Catering Services || 🛵 Delivery',
    category: 'restaurant',
    businessType: 'service_provider',
    address: 'Lagos, Nigeria',
    location: {
      type: 'Point',
      coordinates: [3.3792, 6.5244], // Default Lagos coords
      address: 'Lagos, Nigeria'
    },
    status: 'approved',
    isVisible: true,
    isOpen: true,
    rating: 5.0,
    totalRatings: 0,
    totalOrders: 0,
    preOrderOnly: false,
    deliveryFee: 500,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await mongoose.connection.collection('vendors').insertOne(vendorObj);
  console.log(`Created vendor: ${vendorObj.storeName}`);

  await mongoose.disconnect();
  console.log('Done');
}

run().catch(console.error);
