const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/erranders');
  console.log('Connected to DB');

  const email = 'chipsbymotee@vendor.com';
  const password = 'MoteePassword123!';
  const hashedPassword = await bcrypt.hash(password, 10);

  // 1. Create User
  const userObj = {
    _id: new mongoose.Types.ObjectId(),
    firstName: 'Chips',
    lastName: 'By Motee',
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
    storeName: 'Chips by Motee',
    subdomain: 'moteechips',
    description: 'Crunchy Snacks Vendor - Lagos, Nigeria. Chips by Motee (CBM) is a popular student-founded crunchy snack brand based in Lagos, Nigeria.',
    category: 'snacks',
    businessType: 'physical_product',
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

  // 3. Create Products
  const products = [
    {
      vendor: vendorObj._id,
      name: 'Plantain Chips Pouch',
      description: 'Crunchy plantain chips pouch',
      price: 600,
      image: '',
      category: 'snacks',
      inStock: true,
      isVisible: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      vendor: vendorObj._id,
      name: 'Plantain Chips Jar',
      description: 'Large jar of crunchy plantain chips',
      price: 4000,
      image: '',
      category: 'snacks',
      inStock: true,
      isVisible: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  await mongoose.connection.collection('products').insertMany(products);
  console.log(`Created ${products.length} products`);

  await mongoose.disconnect();
  console.log('Done');
}

run().catch(console.error);
