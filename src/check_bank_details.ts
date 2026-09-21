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

const VendorSchema = new mongoose.Schema({}, { strict: false });
const Vendor = mongoose.model('Vendor', VendorSchema, 'vendors');

async function run() {
  await mongoose.connect(MONGODB_URI as string);
  console.log("Connected to MongoDB");

  const vendors = await Vendor.find({ bankDetails: { $exists: true } });
  console.log(`Vendors with bankDetails: ${vendors.length}`);

  let missingInWallet = 0;
  for (const v of vendors) {
    const vendorDoc = v as any;
    if (!vendorDoc.bankDetails || !vendorDoc.bankDetails.accountNumber) continue;
    
    const wallet = await Wallet.findOne({ owner: vendorDoc.owner }) as any;
    if (wallet) {
      if (!wallet.bankDetails || !wallet.bankDetails.accountNumber) {
        missingInWallet++;
        // sync it over
        await Wallet.updateOne({ _id: wallet._id }, { $set: { bankDetails: vendorDoc.bankDetails } });
      }
    }
  }

  console.log(`Synced ${missingInWallet} bankDetails from vendor to wallet`);
  mongoose.disconnect();
}

run().catch(console.error);
