require('dotenv').config();
const mongoose = require('mongoose');

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const User = mongoose.connection.collection('users');
  const Wallet = mongoose.connection.collection('wallets');
  const Transaction = mongoose.connection.collection('transactions');

  const user = await User.findOne({ email: 'abbie.aigbehi@gmail.com' });
  if (!user) {
    console.log('User not found');
    process.exit(1);
  }

  console.log('User found:', user._id);
  
  const wallet = await Wallet.findOne({ user: user._id });
  console.log('Wallet balance:', wallet ? wallet.balance : 'No wallet');

  const transactions = await Transaction.find({ user: user._id, description: /Refund/i }).toArray();
  console.log('Refund transactions:');
  transactions.forEach(t => {
    console.log(`- Amount: ${t.amount}, Description: ${t.description}, Date: ${t.createdAt}`);
  });

  process.exit(0);
}

check();
