import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const Order = mongoose.models.Order || mongoose.model('Order', new mongoose.Schema({}, { strict: false }));
const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', new mongoose.Schema({}, { strict: false }));
const Wallet = mongoose.models.Wallet || mongoose.model('Wallet', new mongoose.Schema({}, { strict: false }));
const Vendor = mongoose.models.Vendor || mongoose.model('Vendor', new mongoose.Schema({}, { strict: false }));
const Notification = mongoose.models.Notification || mongoose.model('Notification', new mongoose.Schema({}, { strict: false }));

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('Connected to DB');

    // Delete all orders
    const deleteOrders = await Order.deleteMany({});
    console.log(`Deleted ${deleteOrders.deletedCount} orders.`);

    // Delete all transactions
    const deleteTransactions = await Transaction.deleteMany({});
    console.log(`Deleted ${deleteTransactions.deletedCount} transactions.`);
    
    // Delete all notifications (clean slate)
    const deleteNotifications = await Notification.deleteMany({});
    console.log(`Deleted ${deleteNotifications.deletedCount} notifications.`);

    // Reset all wallets to zero
    const updateWallets = await Wallet.updateMany({}, { $set: { balance: 0, totalEarned: 0 } });
    console.log(`Reset ${updateWallets.modifiedCount} wallets to zero balance.`);

    // Reset vendor stats
    const updateVendors = await Vendor.updateMany({}, { $set: { totalOrders: 0 } });
    console.log(`Reset stats for ${updateVendors.modifiedCount} vendors.`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected');
  }
}

run();
