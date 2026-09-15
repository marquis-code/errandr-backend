import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/erranders';

async function checkPacks() {
  await mongoose.connect(MONGO_URI);
  const vendorModel = mongoose.connection.collection('vendors');
  const vendor = await vendorModel.findOne({ storeName: { $regex: /peace/i } });
  console.log(JSON.stringify(vendor?.packs, null, 2));
  mongoose.disconnect();
}
checkPacks();
