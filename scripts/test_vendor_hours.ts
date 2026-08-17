import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const VendorSchema = new mongoose.Schema({}, { strict: false });
const Vendor = mongoose.models.Vendor || mongoose.model('Vendor', VendorSchema);

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);
    const vendor = await Vendor.findOne({ "businessHours": { $exists: true } }).lean();
    console.log(vendor ? vendor.businessHours : 'No vendor found with businessHours');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

run();
