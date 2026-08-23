import * as mongoose from 'mongoose';
import * as fs from 'fs';

async function check() {
  const uri = fs.readFileSync('scratch/uri.txt', 'utf8').trim().replace(/^"|"$/g, '');
  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db!;
    
    const settings = await db.collection('settings').find().toArray();
    console.log('Settings:', settings);
    
    const adminSettings = await db.collection('adminsettings').find().toArray();
    console.log('AdminSettings:', adminSettings);
    
    // Also let's see how many transactions were actually created for Halima
    const user = await db.collection('users').findOne({ firstName: /halima/i, lastName: /onitiju/i });
    if (user) {
        const txs = await db.collection('transactions').find({ user: user._id }).toArray();
        console.log(`Found ${txs.length} transactions for Halima.`);
        console.log(txs);
    }
  } finally {
    await mongoose.disconnect();
  }
}

check().catch(console.error);
