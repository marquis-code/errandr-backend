import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

const SystemSettingSchema = new mongoose.Schema({
  platformServiceFeePercentage: { type: Number, default: 7 },
  platformProcessingFee: { type: Number, default: 0 },
}, { strict: false });

const SystemSetting = mongoose.models.SystemSetting || mongoose.model('SystemSetting', SystemSettingSchema);

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/erranders');
  
  const updated = await SystemSetting.updateMany({}, {
    $set: {
      platformServiceFeePercentage: 7,
      platformProcessingFee: 0
    }
  });
  
  console.log(`Updated settings. Modified count: ${updated.modifiedCount}`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
