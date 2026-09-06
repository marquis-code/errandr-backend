require('dotenv').config();
const mongoose = require('mongoose');

async function fix() {
  await mongoose.connect(process.env.MONGODB_URI);
  const User = mongoose.connection.collection('users');
  const Wallet = mongoose.connection.collection('wallets');

  const user = await User.findOne({ email: 'abbie.aigbehi@gmail.com' });
  if (!user) {
    console.log('User not found');
    process.exit(1);
  }

  const walletBefore = await Wallet.findOne({ owner: user._id });
  console.log('Wallet balance before:', walletBefore ? walletBefore.balance : 'No wallet');

  if (walletBefore) {
    await Wallet.updateOne(
      { owner: user._id },
      { $inc: { balance: 50 } }
    );
    const walletAfter = await Wallet.findOne({ owner: user._id });
    console.log('Wallet balance after:', walletAfter.balance);
    console.log('Successfully refunded 50 naira to owner.');
  }

  process.exit(0);
}

fix();
