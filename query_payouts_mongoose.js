const mongoose = require('mongoose');

async function main() {
  const uri = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/test?appName=errandr";
  await mongoose.connect(uri);

  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    // find user
    const users = db.collection('users');
    let user = await users.findOne({ email: 'ahmedthompson79@gmail.com' });
    
    if (!user) {
      const vendors = db.collection('vendors');
      user = await vendors.findOne({ email: 'ahmedthompson79@gmail.com' });
    }
    
    if (user) {
      console.log('Found user:', user.email, user._id);
      const transactions = db.collection('transactions');
      const txs = await transactions.find({ user: user._id, $or: [{ type: /withdraw/i }, { description: /withdraw/i }, { description: /payout/i }] }).sort({ createdAt: -1 }).toArray();
      console.log('Transactions:');
      txs.forEach(t => console.log(`- Date: ${t.createdAt}, Amount: ${t.amount}, Desc: ${t.description}, Status: ${t.status || 'Success'}`));
    } else {
      console.log('User not found');
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(console.error);
