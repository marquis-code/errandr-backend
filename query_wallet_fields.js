const mongoose = require('mongoose');
async function main() {
  const uri = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/test?appName=errandr";
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  
  const wallets = await db.collection('wallets').find({}).limit(5).toArray();
  console.log('Sample wallets:', wallets.map(w => Object.keys(w)));
  
  let user = await db.collection('vendors').findOne({ email: 'ahmedthompson79@gmail.com' });
  if (user) {
    const w = await db.collection('wallets').find({ $or: [{ user: user._id }, { vendor: user._id }, { userId: user._id }] }).toArray();
    console.log('Found wallets for vendor:', w.length);
    console.log(w);
  }
  await mongoose.disconnect();
}
main().catch(console.error);
