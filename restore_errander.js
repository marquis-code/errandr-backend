const mongoose = require('mongoose');
require('dotenv').config();
const bcrypt = require('bcryptjs');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const usersCollection = mongoose.connection.collection('users');
  const errandersCollection = mongoose.connection.collection('erranders');

  // Check if exists
  const exists = await usersCollection.findOne({ email: 'nkemonyekaiwegbu@gmail.com' });
  if (exists) {
    console.log('User already exists');
    process.exit(0);
  }

  // Insert User
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('password123', salt);

  const userResult = await usersCollection.insertOne({
    firstName: 'Onyekachukwu',
    lastName: 'Iwegbu',
    email: 'nkemonyekaiwegbu@gmail.com',
    password: hashedPassword,
    role: 'errander',
    isVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    __v: 0
  });

  const userId = userResult.insertedId;

  // Insert Errander Profile
  await errandersCollection.insertOne({
    user: userId,
    status: 'available',
    currentLocation: {
      type: 'Point',
      coordinates: [0, 0]
    },
    totalDeliveries: 0,
    totalEarnings: 0,
    rating: 0,
    totalRatings: 0,
    isApproved: true,
    isVerified: true,
    batchOrders: [],
    orderHistory: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    __v: 0
  });

  console.log('Restored Onyekachukwu Iwegbu successfully.');
  await mongoose.disconnect();
}

run().catch(console.error);
