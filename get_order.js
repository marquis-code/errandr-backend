const mongoose = require('mongoose');

async function getOrder() {
  await mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr');
  const db = mongoose.connection;
  
  // Find the most recent active or pending order to inspect
  const order = await db.collection('orders').findOne({ status: { $in: ['active', 'confirmed', 'preparing', 'ready_for_pickup'] } }, { sort: { createdAt: -1 } });
  if (order) {
    console.log('Order ID:', order._id);
    console.log('ITEMS:');
    console.log(JSON.stringify(order.items, null, 2));
    console.log('PACKS:');
    console.log(JSON.stringify(order.packs, null, 2));
  } else {
    console.log("No active orders found");
  }
  
  mongoose.disconnect();
}
getOrder();
