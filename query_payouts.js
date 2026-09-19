const { MongoClient } = require('mongodb');

async function main() {
  const uri = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/errandr?appName=errandr";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('test'); // Usually 'test' is default unless specified, let's check collections
    const collections = await db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));
    
    // find user
    const users = db.collection('users');
    const user = await users.findOne({ email: 'ahmedthompson79@gmail.com' });
    
    if (!user) {
      console.log('User not found in users collection');
      // let's try vendors
      const vendors = db.collection('vendors');
      const vendor = await vendors.findOne({ email: 'ahmedthompson79@gmail.com' });
      if (vendor) {
        console.log('Found vendor:', vendor.email, vendor._id);
        const transactions = db.collection('transactions');
        const txs = await transactions.find({ user: vendor._id, $or: [{ type: /withdraw/i }, { description: /withdraw/i }, { description: /payout/i }] }).sort({ createdAt: -1 }).toArray();
        console.log('Transactions:', txs);
      } else {
         console.log('Vendor not found either');
      }
    } else {
      console.log('Found user:', user.email, user._id);
      const transactions = db.collection('transactions');
      const txs = await transactions.find({ user: user._id, $or: [{ type: /withdraw/i }, { description: /withdraw/i }, { description: /payout/i }] }).sort({ createdAt: -1 }).toArray();
      console.log('Transactions:', txs);
    }
  } finally {
    await client.close();
  }
}

main().catch(console.error);
