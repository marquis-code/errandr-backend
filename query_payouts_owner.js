const mongoose = require('mongoose');
async function main() {
  const uri = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/test?appName=errandr";
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  
  let user = await db.collection('users').findOne({ email: 'ahmedthompson79@gmail.com' });
  if (!user) user = await db.collection('vendors').findOne({ email: 'ahmedthompson79@gmail.com' });
  
  if (user) {
    const wallet = await db.collection('wallets').findOne({ owner: user._id });
    if (wallet) {
      console.log(`Found wallet: balance=${wallet.balance}`);
      const txs = await db.collection('transactions').find({ 
        wallet: wallet._id,
        $or: [{ type: /withdraw/i }, { description: /withdraw/i }, { description: /payout/i }]
      }).sort({ createdAt: -1 }).toArray();
      
      console.log(`Payout History for ${user.email} (Wallet: ${wallet._id}):`);
      txs.forEach(t => console.log(`- Date: ${t.createdAt}, Amount: ${t.amount}, Type: ${t.type}, Desc: ${t.description}, Status: ${t.status || 'completed'}`));
    }
  }
  await mongoose.disconnect();
}
main().catch(console.error);
