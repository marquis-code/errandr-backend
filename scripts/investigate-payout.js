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
    const vendorsCollection = db.collection('vendors');
    const walletsCollection = db.collection('wallets'); // Assuming there's a wallets collection
    const transactionsCollection = db.collection('transactions');

    // 1. Find the order
    const order = await ordersCollection.findOne({ orderNumber: ORDER_NUMBER });

    if (!order) {
      console.error(`❌ Order ${ORDER_NUMBER} not found`);
      process.exit(1);
    }

    console.log(`📦 Order Found: ${order.orderNumber}`);
    console.log(`   Status: ${order.status}`);
    console.log(`   Total: ₦${order.total}`);
    console.log(`   Vendor ID: ${order.vendor}`);

    // 2. Find the vendor
    const vendor = await vendorsCollection.findOne({ _id: order.vendor });
    if (!vendor) {
      console.error(`❌ Vendor ${order.vendor} not found`);
      process.exit(1);
    }
    console.log(`🏪 Vendor: ${vendor.storeName} (Owner: ${vendor.owner})`);

    // 3. Check for existing transaction for this order
    const txn = await transactionsCollection.findOne({ 
      orderId: order._id,
      type: 'credit' // or however credits are marked
    });

    if (txn) {
      console.log(`💰 Existing Transaction Found: ₦${txn.amount} (${txn.status})`);
    } else {
      console.log(`⚠️ No credit transaction found for this order.`);
      
      // Calculate earnings (matching logic in orders.service.ts)
      const platformCommissionRate = 0.05;
      const vendorEarnings = Math.round(order.subtotal * (1 - platformCommissionRate));
      console.log(`💡 Calculated Vendor Earnings: ₦${vendorEarnings} (Subtotal: ₦${order.subtotal})`);
    }

  } catch (error) {
    console.error('❌ An error occurred:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

main().catch(console.error);
