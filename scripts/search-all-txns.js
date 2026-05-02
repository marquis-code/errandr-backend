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
const ORDER_ID = '69c9f9b60ffbd3dd77181be9';

async function main() {
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not found in .env file');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected successfully to MongoDB');
    
    const db = mongoose.connection.db;
    const transactionsCollection = db.collection('transactions');

    const txns = await transactionsCollection.find({ order: new mongoose.Types.ObjectId(ORDER_ID) }).toArray();

    if (txns.length > 0) {
      console.log(`💰 Found ${txns.length} transaction(s) for order ${ORDER_ID}:`);
      console.log(JSON.stringify(txns, null, 2));
    } else {
      console.log(`❌ NO transactions found for order ${ORDER_ID} using field 'order'.`);
      
      const txnsAlt = await transactionsCollection.find({ orderId: new mongoose.Types.ObjectId(ORDER_ID) }).toArray();
      if (txnsAlt.length > 0) {
        console.log(`💰 Found ${txnsAlt.length} transaction(s) for order ${ORDER_ID} using field 'orderId':`);
        console.log(JSON.stringify(txnsAlt, null, 2));
      } else {
        console.log(`❌ NO transactions found for order ${ORDER_ID} using field 'orderId' either.`);
      }
    }

  } catch (error) {
    console.error('❌ An error occurred:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

main().catch(console.error);
