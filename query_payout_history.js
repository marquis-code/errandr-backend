const mongoose = require('mongoose');
async function main() {
  const uri = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/test?appName=errandr";
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  
  let user = await db.collection('users').findOne({ email: 'ahmedthompson79@gmail.com' });
  if (!user) user = await db.collection('vendors').findOne({ email: 'ahmedthompson79@gmail.com' });
  
  if (user) {
    console.log(`Found user: ${user.email} (${user._id})`);
    const wallet = await db.collection('wallets').findOne({ user: user._id });
    
    if (wallet) {
      console.log(`Found wallet: ${wallet._id}, balance: ${wallet.balance}`);
      const txs = await db.collection('transactions').find({ 
        wallet: wallet._id,
        $or: [{ description: /withdraw/i }, { description: /payout/i }, { type: /withdraw/i }]
      }).sort({ createdAt: -1 }).toArray();
      
      console.log(`Found ${txs.length} payout/withdrawal transactions:`);
      txs.forEach(t => console.log(`- Date: ${t.createdAt}, Amount: ${t.amount}, Desc: ${t.description}, Status: ${t.status || 'completed'}`));
    } else {
      console.log('No wallet found for this user.');
    }
  } else {
    console.log('User not found.');
  }
  await mongoose.disconnect();
}
main().catch(console.error);
