const { MongoClient } = require('mongodb');

async function run() {
  const uri = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    
    // List databases
    const adminDb = client.db('admin').admin();
    const dbs = await adminDb.listDatabases();
    
    console.log("Databases:");
    dbs.databases.forEach(db => console.log(` - ${db.name}`));
    
    // Check orders count in each
    for (const dbInfo of dbs.databases) {
      if (dbInfo.name === 'admin' || dbInfo.name === 'local') continue;
      const count = await client.db(dbInfo.name).collection('orders').countDocuments();
      if (count > 0) {
        console.log(`Database ${dbInfo.name} has ${count} orders`);
        const order = await client.db(dbInfo.name).collection('orders').findOne({ orderNumber: { $regex: /ERR-1791664789883/ } });
        if (order) {
            console.log(`Found order in ${dbInfo.name}:`, order.orderNumber);
        } else {
            const pay = await client.db(dbInfo.name).collection('orders').findOne({ paymentReference: { $regex: /1791664789883/ } });
            if (pay) console.log(`Found by payment ref in ${dbInfo.name}:`, pay.orderNumber);
        }
      }
    }

  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

run();
