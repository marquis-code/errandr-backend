const { MongoClient } = require('mongodb');

async function checkOrder() {
  const uri = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('test'); // Or whatever the DB name is, let's assume 'test' from the URI, or maybe it connects to the default. Wait, the uri string is ?appName=errandr, let's just use the connection
    
    // Actually, it's safer to use mongoose if it's already set up.
    // But MongoClient can find the DB name easily. Let's just list databases and collections.
  } finally {
    await client.close();
  }
}
checkOrder();
