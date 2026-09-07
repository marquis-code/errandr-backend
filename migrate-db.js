const mongoose = require('mongoose');
async function run() {
  await mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr');
  const db = mongoose.connection.db;
  
  const orders = await db.collection('marketpoolorders').find({}).toArray();
  for (const order of orders) {
    let update = {};
    if (typeof order.campaignId === 'string') update.campaignId = new mongoose.Types.ObjectId(order.campaignId);
    if (typeof order.userId === 'string') update.userId = new mongoose.Types.ObjectId(order.userId);
    
    if (Object.keys(update).length > 0) {
      await db.collection('marketpoolorders').updateOne({ _id: order._id }, { $set: update });
    }
  }

  const requests = await db.collection('marketpoolcustomrequests').find({}).toArray();
  for (const req of requests) {
    let update = {};
    if (typeof req.campaignId === 'string') update.campaignId = new mongoose.Types.ObjectId(req.campaignId);
    if (typeof req.userId === 'string') update.userId = new mongoose.Types.ObjectId(req.userId);
    
    if (Object.keys(update).length > 0) {
      await db.collection('marketpoolcustomrequests').updateOne({ _id: req._id }, { $set: update });
    }
  }

  console.log("Migration complete");
  process.exit(0);
}
run().catch(console.error);
