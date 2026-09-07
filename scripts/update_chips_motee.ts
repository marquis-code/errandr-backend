import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const VendorSchema = new mongoose.Schema({
  storeName: String,
  businessHours: [mongoose.Schema.Types.Mixed]
}, { strict: false });
const Vendor = mongoose.models.Vendor || mongoose.model('Vendor', VendorSchema);

const createSchedule = (open: string, close: string) => {
  return [
    { day: 'monday', open, close, isClosed: false },
    { day: 'tuesday', open, close, isClosed: false },
    { day: 'wednesday', open, close, isClosed: false },
    { day: 'thursday', open, close, isClosed: false },
    { day: 'friday', open, close, isClosed: false },
    { day: 'saturday', open, close, isClosed: false },
    { day: 'sunday', open, close, isClosed: false }
  ];
};

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);
    const schedule = createSchedule('10:00', '23:00');
    const res = await Vendor.updateOne(
      { storeName: { $regex: new RegExp('Chips by Motee', 'i') } },
      { $set: { businessHours: schedule } }
    );
    console.log(`Updated Chips by Motee: matched ${res.matchedCount}, modified ${res.modifiedCount}`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

run();
