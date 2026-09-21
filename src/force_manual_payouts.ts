import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("No MongoDB URI found");
  process.exit(1);
}

const WalletSchema = new mongoose.Schema({}, { strict: false });
const Wallet = mongoose.model('Wallet', WalletSchema, 'wallets');

async function run() {
  await mongoose.connect(MONGODB_URI as string);
  console.log("Connected to MongoDB");

  const totalWallets = await Wallet.countDocuments();
  console.log(`Total wallets in DB: ${totalWallets}`);

  const activeSweeps = await Wallet.countDocuments({ payoutPreference: { $in: ['daily', 'weekly', 'monthly'] } });
  console.log(`Wallets configured for auto-sweep: ${activeSweeps}`);
  
  const noPref = await Wallet.countDocuments({ payoutPreference: { $exists: false } });
  console.log(`Wallets with no preference (would have defaulted to old weekly): ${noPref}`);

  // Force all existing wallets to manual
  const result = await Wallet.updateMany(
    {}, 
    { $set: { payoutPreference: 'manual' } }
  );

  console.log(`Successfully updated ${result.modifiedCount} wallets to manual payout preference.`);
  console.log(`All vendors and erranders are now strictly on 'manual' payout by default!`);

  mongoose.disconnect();
}

run().catch(console.error);
