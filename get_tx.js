const { MongoClient } = require('mongodb');

async function run() {
  const uri = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('test');
    
    const tx = await db.collection('transactions').findOne({ reference: 'ERR-1791664789883-221' });
    if (tx) {
      console.log("Transaction found:");
      console.log(tx);
    } else {
      console.log("Transaction not found.");
    }
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

run();
