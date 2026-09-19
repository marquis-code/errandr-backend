import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

const VendorSchema = new mongoose.Schema({}, { strict: false });
const Vendor = mongoose.model('Vendor', VendorSchema, 'vendors');
const UserSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', UserSchema, 'users');
const WalletSchema = new mongoose.Schema({}, { strict: false });
const Wallet = mongoose.model('Wallet', WalletSchema, 'wallets');
const TransactionSchema = new mongoose.Schema({}, { strict: false });
const Transaction = mongoose.model('Transaction', TransactionSchema, 'transactions');

async function run() {
  await mongoose.connect(MONGODB_URI as string);
  console.log("Connected to MongoDB");

  const vendor = await Vendor.findOne({ storeName: { $regex: /Waris Kitchen/i } });
  if (!vendor) {
    console.log("Vendor Waris Kitchen not found");
    process.exit(0);
  }
  
  console.log(`Found vendor: ${vendor._id}, Owner: ${vendor.get('owner')}`);
  
  const ownerId = vendor.get('owner');
  const wallet = await Wallet.findOne({ owner: ownerId });
  
  if (!wallet) {
    console.log("Wallet not found for owner");
    process.exit(0);
  }
  
  console.log(`Found wallet: ${wallet._id}`);
  
  const transactions = await Transaction.find({ wallet: wallet._id }).sort({ createdAt: -1 }).limit(10);
  console.log(`Recent transactions for this wallet:`);
  
  for (const t of transactions) {
    console.log(`ID: ${t._id}, Type: ${t.get('type')}, Status: ${t.get('status')}, Amount: ${t.get('amount')}, Desc: ${t.get('description')}, Meta:`, JSON.stringify(t.get('metadata')));
  }

  mongoose.disconnect();
}

run().catch(console.error);
