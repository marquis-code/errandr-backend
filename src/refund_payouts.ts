import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("No MongoDB URI found");
  process.exit(1);
}

const TransactionSchema = new mongoose.Schema({}, { strict: false });
const Transaction = mongoose.model('Transaction', TransactionSchema, 'transactions');
const WalletSchema = new mongoose.Schema({}, { strict: false });
const Wallet = mongoose.model('Wallet', WalletSchema, 'wallets');
const UserSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', UserSchema, 'users');

async function run() {
  await mongoose.connect(MONGODB_URI as string);
  console.log("Connected to MongoDB");

  const pendingPayouts = await Transaction.find({
    type: 'DEBIT',
    status: 'PENDING',
    'metadata.isPayoutRequest': true
  });

  console.log(`Found ${pendingPayouts.length} pending payouts.`);
  let refunded = 0;

  for (const p of pendingPayouts) {
    const meta = p.get('metadata') || {};
    console.log(`- ID: ${p._id}, Amount: ${p.get('amount')}, Date: ${p.get('createdAt')}, HasTransferCode: ${!!meta.transferCode}`);
    
    if (!meta.transferCode) {
      console.log(`Refunding stuck payout ${p._id}...`);
      
      const walletId = p.get('wallet');
      const wallet = await Wallet.findById(walletId);
      
      if (wallet) {
        const ownerId = wallet.get('owner');
        const amount = p.get('amount');
        
        await Wallet.updateOne({ _id: walletId }, { $inc: { balance: amount } });
        if (ownerId) {
          await User.updateOne({ _id: ownerId }, { $inc: { walletBalance: amount } });
        }
        
        await Transaction.updateOne({ _id: p._id }, { 
          $set: { 
            status: 'FAILED',
            description: p.get('description') + ' (FAILED - Refunded via script)'
          }
        });
        
        console.log(`Successfully refunded ${amount} for wallet ${walletId}`);
        refunded++;
      } else {
        console.log(`Wallet not found for transaction ${p._id}`);
      }
    } else {
      console.log(`Skipping ${p._id} because it has a transferCode and might be processing on Paystack.`);
    }
  }

  console.log(`Done. Refunded ${refunded} stuck payouts.`);
  mongoose.disconnect();
}

run().catch(console.error);
