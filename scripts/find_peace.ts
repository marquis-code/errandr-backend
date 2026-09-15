import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/erranders';

async function findPeace() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to DB');

  const vendorModel = mongoose.connection.collection('vendors');
  const userModel = mongoose.connection.collection('users');

  const vendor = await vendorModel.findOne({ storeName: { $regex: /peace/i } });
  if (vendor) {
    console.log('Vendor Found:', vendor.storeName);
    const user = await userModel.findOne({ _id: vendor.owner });
    if (user) {
        console.log('User Login Email:', user.email);
        console.log('User Role:', user.role);
    } else {
        console.log('Owner user not found for id:', vendor.owner);
    }
  } else {
    console.log('Vendor with name containing "peace" not found.');
  }

  mongoose.disconnect();
}

findPeace();
