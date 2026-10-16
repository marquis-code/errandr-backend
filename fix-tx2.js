const { MongoClient, ObjectId } = require('mongodb');

async function fix() {
  const erranderDb = new MongoClient("mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr");
  const barterDb = new MongoClient("mongodb+srv://abahmarquis_db_user:RnmGsoHqJxPOnoFH@erranders-barter.gkrvfwj.mongodb.net/?appName=erranders-barter");
  
  try {
    await erranderDb.connect();
    await barterDb.connect();
    
    const eDb = erranderDb.db('test');
    const bDb = barterDb.db('test');
    
    const bids = await eDb.collection('deliverybids').find().sort({createdAt:-1}).limit(5).toArray();
    console.log('Recent bids:', bids);
    
    const order = await eDb.collection('orders').findOne({ _id: bids[0].order });
    console.log('Order for latest bid:', order.customDetails.description);
    
    if (order.customDetails.description.includes('6ac7a7791c5284207d804113')) {
      const result = await bDb.collection('transactions').updateOne(
        { _id: new ObjectId('6ac7a7791c5284207d804113') },
        { $set: { erranderOrderId: order._id.toString(), erranderBidId: bids[0]._id.toString() } }
      );
      console.log('Updated Barter Tx:', result.modifiedCount);
    }
    
  } catch (e) {
    console.error(e);
  } finally {
    await erranderDb.close();
    await barterDb.close();
  }
}
fix();
