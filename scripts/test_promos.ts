import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PromoSchema = new mongoose.Schema({}, { strict: false });
const Promo = mongoose.models.Promo || mongoose.model('Promo', PromoSchema);

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);
    const promos = await Promo.find().populate('vendorId').lean();
    console.log(JSON.stringify(promos[0], null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

run();
