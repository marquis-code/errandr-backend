import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const VendorSchema = new mongoose.Schema({}, { strict: false });
const Vendor = mongoose.models.Vendor || mongoose.model('Vendor', VendorSchema);

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('Connected to DB');

    // Find vendor matching HVIP
    const result = await Vendor.updateMany(
      { storeName: { $regex: /HVIP/i } },
      { $set: { isOpen: false, statusMessage: 'closed' } }
    );
    
    console.log(`Matched ${result.matchedCount}, Modified ${result.modifiedCount}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected');
  }
}

run();
