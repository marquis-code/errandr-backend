const { MongoClient, ObjectId } = require('mongodb');

async function fix() {
  const erranderDb = new MongoClient("mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr");
  const barterDb = new MongoClient("mongodb+srv://abahmarquis_db_user:RnmGsoHqJxPOnoFH@erranders-barter.gkrvfwj.mongodb.net/?appName=erranders-barter");
  
  try {
    await erranderDb.connect();
    await barterDb.connect();
    
    // Default db is extracted from the URI for Atlas
    const eDb = erranderDb.db(); 
    const bDb = barterDb.db();
    
    // Find order
    const order = await eDb.collection('orders').findOne({ "customDetails.description": { $regex: '6ac7a7791c5284207d804113' } });
    if (!order) {
      console.log('Order not found');
      return;
    }
    console.log('Found Order:', order._id);
    
    // Find bid
    const bid = await eDb.collection('deliverybids').findOne({ order: order._id });
    if (!bid) {
      console.log('Bid not found');
      return;
    }
    console.log('Found Bid:', bid._id);
    
    // Update barter tx
    const result = await bDb.collection('transactions').updateOne(
      { _id: new ObjectId('6ac7a7791c5284207d804113') },
      { $set: { erranderOrderId: order._id.toString(), erranderBidId: bid._id.toString() } }
    );
    
    console.log('Updated Barter Tx:', result.modifiedCount);
    
  } catch (e) {
    console.error(e);
  } finally {
    await erranderDb.close();
    await barterDb.close();
  }
}
fix();
