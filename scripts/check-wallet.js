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
const WALLET_ID = '69c019bf023f34111f9a569b';

async function main() {
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not found in .env file');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected successfully to MongoDB');
    
    const db = mongoose.connection.db;
    const walletsCollection = db.collection('wallets');
    const usersCollection = db.collection('users');

    const wallet = await walletsCollection.findOne({ _id: new mongoose.Types.ObjectId(WALLET_ID) });

    if (wallet) {
      console.log('💰 Wallet Details:');
      console.log(JSON.stringify(wallet, null, 2));

      const owner = await usersCollection.findOne({ _id: wallet.owner });
      if (owner) {
         console.log(`👤 Owner Found: ${owner.firstName} ${owner.lastName} (${owner.email})`);
      } else {
         console.log(`❌ Owner ${wallet.owner} NOT found.`);
      }
    } else {
      console.log(`❌ Wallet ${WALLET_ID} NOT found.`);
    }

  } catch (error) {
    console.error('❌ An error occurred:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

main().catch(console.error);
