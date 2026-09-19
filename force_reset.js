const mongoose = require('mongoose');
const MONGO_URI = 'mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr';
mongoose.connect(MONGO_URI);
const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false, collection: 'orders' }));

async function reset() {
  const order = await Order.findById('6aae8af0d17115d715f52d3d');
  
  const items = order.get('items') || [];
  for (let i = 0; i < items.length; i++) {
    items[i].status = 'active';
    delete items[i].substituteOptions;
  }
  order.set('items', items);
  order.markModified('items');

  const packs = order.get('packs') || [];
  for (let p = 0; p < packs.length; p++) {
    const packItems = packs[p].items || [];
    for (let i = 0; i < packItems.length; i++) {
      packItems[i].status = 'active';
      delete packItems[i].substituteOptions;
    }
  }
  order.set('packs', packs);
  order.markModified('packs');

  await order.save();
  console.log('Reset order to active');
  process.exit(0);
}
reset();
