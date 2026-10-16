const { MongoClient } = require('mongodb');

async function run() {
  const uri = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('test');
    
    // Check if there are any errors in the backend logs or if we can see why a group order fails
    console.log("Checking last 5 orders in test database...");
    const orders = await db.collection('orders').find({}).sort({ _id: -1 }).limit(5).toArray();
    orders.forEach(o => {
        console.log(`Order: ${o.orderNumber}, Group: ${o.isGroupOrder}, Type: ${o.type}, Customer: ${o.customer}, Status: ${o.status}`);
    });

  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

run();
