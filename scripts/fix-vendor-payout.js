const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Basic .env parser
function loadEnv() {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const index = line.indexOf('=');
      if (index > -1) {
        const key = line.substring(0, index).trim();
        const value = line.substring(index + 1).trim().replace(/['"]/g, '');
        process.env[key] = value;
      }
    });
  }
}

loadEnv();

const MONGODB_URI = process.env.MONGODB_URI;
const ORDER_NUMBER = 'ERR-477F9AAF';
const VENDOR_OWNER_ID = '69bf1be57bd24adc3fce8de6';
const EARNINGS = 2850;

async function main() {
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not found in .env file');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected successfully to MongoDB');
    
    const db = mongoose.connection.db;
    const ordersCollection = db.collection('orders');
    const walletsCollection = db.collection('wallets');
    const transactionsCollection = db.collection('transactions');

    // 1. Double check order again
    const order = await ordersCollection.findOne({ orderNumber: ORDER_NUMBER });
    if (!order) {
      console.error(`❌ Order ${ORDER_NUMBER} not found`);
      process.exit(1);
    }

    // 2. Check for existing transaction one last time
    const existingTxn = await transactionsCollection.findOne({ 
      order: order._id 
    });

    if (existingTxn) {
      console.log(`⚠️ Transaction already exists: ${existingTxn._id}. Aborting to prevent double credit.`);
      process.exit(0);
    }

    console.log(`🚀 Proceeding to credit ₦${EARNINGS} to Vendor Owner ${VENDOR_OWNER_ID}...`);

    // 3. Find or Create Wallet
    let wallet = await walletsCollection.findOne({ owner: new mongoose.Types.ObjectId(VENDOR_OWNER_ID) });
    
    if (!wallet) {
      console.log(`ℹ️ Wallet not found for owner. Creating new wallet...`);
      const newWallet = {
        owner: new mongoose.Types.ObjectId(VENDOR_OWNER_ID),
        balance: EARNINGS,
        totalEarned: EARNINGS,
        payoutPreference: 'bank_transfer',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const insertResult = await walletsCollection.insertOne(newWallet);
      wallet = { ...newWallet, _id: insertResult.insertedId };
    } else {
      console.log(`💰 Updating existing wallet (Current Balance: ₦${wallet.balance})`);
      await walletsCollection.updateOne(
        { _id: wallet._id },
        { 
          $inc: { 
            balance: EARNINGS,
            totalEarned: EARNINGS 
          },
          $set: { updatedAt: new Date() }
        }
      );
    }

    // 4. Create Transaction Record
    const transaction = {
      wallet: wallet._id,
      amount: EARNINGS,
      type: 'credit', // TransactionType.CREDIT
      status: 'completed',
      description: `Manual Payout Fix for order ${ORDER_NUMBER}`,
      order: order._id,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const txnResult = await transactionsCollection.insertOne(transaction);

    console.log(`✅ Successfully credited vendor!`);
    console.log(`   Transaction ID: ${txnResult.insertedId}`);
    console.log(`   New Wallet Balance: ₦${wallet.balance + (wallet.balance !== EARNINGS ? EARNINGS : 0)}`);

  } catch (error) {
    console.error('❌ An error occurred:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

main().catch(console.error);
