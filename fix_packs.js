const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr';
mongoose.connect(MONGO_URI);

const OrderSchema = new mongoose.Schema({
  items: [mongoose.Schema.Types.Mixed],
  menuItems: [mongoose.Schema.Types.Mixed],
  packs: [mongoose.Schema.Types.Mixed]
}, { strict: false, collection: 'orders' });

const Order = mongoose.model('Order', OrderSchema);

async function fix() {
  const orders = await Order.find({ 'packs.items.status': 'pending_substitute' });
  for (const order of orders) {
    let changed = false;
    const packs = order.get('packs') || [];
    for (let p = 0; p < packs.length; p++) {
      const items = packs[p].items || [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].status === 'pending_substitute' && !items[i].substituteOptions) {
          items[i].substituteOptions = [{
            _id: new mongoose.Types.ObjectId().toString(),
            name: 'Alternative ' + items[i].name,
            price: items[i].price,
            quantity: items[i].quantity
          }];
          changed = true;
        }
      }
    }
    if (changed) {
      order.set('packs', packs);
      order.markModified('packs');
      await order.save();
      console.log('Fixed pack order', order._id);
    }
  }

  process.exit(0);
}

fix();
