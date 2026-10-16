const { MongoClient } = require('mongodb');

async function run() {
  const uri = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('test');
    
    let order = await db.collection('orders').findOne({ orderNumber: 'ERR-2674046B' });
    if (order) {
        console.log("Found Daniel order:", order.orderNumber, order.type, order.status, order.createdAt);
    } else {
        console.log("Daniel order not found");
    }

  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

run();
