const mongoose = require('mongoose');

async function clearOrder() {
  await mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr');
  const db = mongoose.connection;
  
  const allOrders = await db.collection('orders').find({}).toArray();
  let found = 0;
  for (const o of allOrders) {
    const idStr = String(o._id).toUpperCase();
    const orderNumStr = String(o.orderNumber || '').toUpperCase();
    const refStr = String(o.reference || '').toUpperCase();
    const shortIdStr = String(o.shortId || '').toUpperCase();
    
    if (idStr.includes('F7281C58') || orderNumStr.includes('F7281C58') || refStr.includes('F7281C58') || shortIdStr.includes('F7281C58')) {
      console.log('Found order!', o._id, 'status:', o.status, 'orderNumber:', o.orderNumber);
      await db.collection('orders').updateOne({ _id: o._id }, { $set: { status: 'cancelled' } });
      console.log('Cancelled exactly.');
      found++;
    }
  }
  console.log('Total found matching string:', found);

  mongoose.disconnect();
}
clearOrder();
