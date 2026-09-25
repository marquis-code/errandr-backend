import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const UserSchema = new mongoose.Schema({}, { strict: false, collection: 'users' });
const UserModel = mongoose.model('User', UserSchema);

const WalletSchema = new mongoose.Schema({}, { strict: false, collection: 'wallets' });
const WalletModel = mongoose.model('Wallet', WalletSchema);

const TransactionSchema = new mongoose.Schema({}, { strict: false, collection: 'transactions', timestamps: true });
const TransactionModel = mongoose.model('Transaction', TransactionSchema);

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log('✅ Connected to MongoDB');

  const email = 'abahmarquis@gmail.com';
  const amountToFund = -5000;
  
  const user: any = await UserModel.findOne({ email });

  if (!user) {
    console.log(`❌ User with email ${email} not found.`);
    await mongoose.disconnect();
    return;
  }

  // Find user's wallet
  let wallet: any = await WalletModel.findOne({ owner: user._id });
  
  if (!wallet) {
    console.log(`❌ Wallet not found for user ${user._id}`);
    await mongoose.disconnect();
    return;
  }

  // Update wallet balances
  await WalletModel.updateOne(
    { _id: wallet._id },
    { 
      $inc: { 
        balance: amountToFund,
        totalEarned: amountToFund 
      } 
    }
  );

  // Update user's cached walletBalance
  await UserModel.updateOne(
    { _id: user._id },
    { $inc: { walletBalance: amountToFund } }
  );

  // Create transaction record
  await TransactionModel.create({
    wallet: wallet._id,
    amount: 5000,
    type: 'debit',
    description: 'Manual vendor wallet deduction',
    reference: `DEDUCT-${uuidv4().slice(0, 8).toUpperCase()}`,
    status: 'completed',
    actionType: 'manual',
  });

  console.log(`✅ Successfully deducted 5000 from ${email}'s wallet.`);

  await mongoose.disconnect();
  console.log('🏁 Done!');
}

main().catch(console.error);
