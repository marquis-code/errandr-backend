const mongoose = require('mongoose');

async function main() {
  const uri = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/test?appName=errandr";
  await mongoose.connect(uri);

  try {
    const db = mongoose.connection.db;
    const users = db.collection('users');
    let user = await users.findOne({ email: 'ahmedthompson79@gmail.com' });
    if (!user) user = await db.collection('vendors').findOne({ email: 'ahmedthompson79@gmail.com' });
    
    if (user) {
      console.log('Found user:', user.email, user._id);
      
      const transactions = db.collection('transactions');
      const txs = await transactions.find({ user: user._id }).sort({ createdAt: -1 }).toArray();
      console.log(`Found ${txs.length} transactions total`);
      txs.forEach(t => console.log(`- Date: ${t.createdAt}, Amount: ${t.amount}, Type: ${t.type}, Desc: ${t.description}, Status: ${t.status}`));
      
      const wallets = db.collection('wallets');
      const wallet = await wallets.findOne({ user: user._id });
      console.log('Wallet:', wallet);
      
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(console.error);
