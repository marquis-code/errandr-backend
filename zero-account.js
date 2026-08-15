const mongoose = require('mongoose');

const MONGODB_URI = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr";

async function zeroAccount() {
  try {
    await mongoose.connect(MONGODB_URI);
    
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
    const Errander = mongoose.model('Errander', new mongoose.Schema({}, { strict: false }), 'erranders');
    const Wallet = mongoose.model('Wallet', new mongoose.Schema({}, { strict: false }), 'wallets');

    const email = 'oyewolegoodness444@gmail.com';
    const user = await User.findOne({ email });

    if (!user) {
      console.log(`User with email ${email} not found.`);
      process.exit(0);
    }

    console.log(`Found user: ${user._id}`);
    
    const errander = await Errander.findOne({ user: user._id });
    if (errander) {
       console.log(`Found errander profile: ${errander._id}`);
       await Errander.updateOne({ _id: errander._id }, {
         $set: {
           totalEarnings: 0,
           totalDeliveries: 0,
           orderHistory: [],
           batchOrders: [],
           currentOrder: null
         }
       });
       console.log('Zeroed errander stats.');
    }
    
    const wallet = await Wallet.findOne({ owner: user._id });
    if (wallet) {
       console.log(`Found wallet: ${wallet._id}`);
       await Wallet.updateOne({ _id: wallet._id }, {
         $set: {
           balance: 0,
           totalEarned: 0,
           ledgerBalance: 0,
           totalEarnings: 0,
           lockedBalance: 0
         }
       });
       console.log('Zeroed wallet balance.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

zeroAccount();
