const mongoose = require('mongoose');

async function fixDb() {
  await mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr');
  const db = mongoose.connection;
  
  const orderId = new mongoose.Types.ObjectId('6aae8af0d17115d715f52d3d');
  const order = await db.collection('orders').findOne({ _id: orderId });
  
  if (order && order.items && order.packs) {
    // Make sure the items array is synced with the packs array
    const packItem = order.packs[0]?.items[0];
    if (packItem && packItem.status === 'substituted') {
      const updatedItems = order.items.map(item => {
        if (item._id.toString() === '6aae8af0d17115d715f52d3e') {
          return { ...item, status: 'substituted', substitutedWith: packItem.substitutedWith, name: packItem.name, price: packItem.price, subtotal: packItem.subtotal };
        }
        return item;
      });
      await db.collection('orders').updateOne({ _id: orderId }, { $set: { items: updatedItems } });
      console.log('Fixed order DB state.');
    }
  }
  
  mongoose.disconnect();
}
fixDb();
