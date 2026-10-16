const { MongoClient } = require('mongodb');

async function run() {
  const uri = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('test');
    
    console.log("Total orders:", await db.collection('orders').countDocuments());

    // Search by anything that matches the reference number
    const target = '1791664789883';
    let order = await db.collection('orders').findOne({ paymentReference: { $regex: target } });
    if (order) {
        console.log("Found by paymentReference:", JSON.stringify(order, null, 2));
    } else {
        order = await db.collection('orders').findOne({ orderNumber: { $regex: target } });
        if (order) console.log("Found by orderNumber:", JSON.stringify(order, null, 2));
        else {
            order = await db.collection('orders').findOne({ groupId: { $regex: target } });
            if (order) console.log("Found by groupId:", JSON.stringify(order, null, 2));
        }
    }
    
    // Also let's check recent group orders just in case
    const groupOrders = await db.collection('orders').find({ isGroupOrder: true }).sort({ createdAt: -1 }).limit(3).toArray();
    console.log("Recent group orders count:", groupOrders.length);
    if (groupOrders.length > 0) {
        console.log("Sample group order ID:", groupOrders[0].orderNumber, groupOrders[0].paymentReference, groupOrders[0]._id);
    }

  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

run();
