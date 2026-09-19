const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr';
mongoose.connect(MONGO_URI);

const OrderSchema = new mongoose.Schema({
  items: [mongoose.Schema.Types.Mixed],
  menuItems: [mongoose.Schema.Types.Mixed]
}, { strict: false, collection: 'orders' });

const Order = mongoose.model('Order', OrderSchema);

async function fix() {
  const orders = await Order.find({ 'items.status': 'pending_substitute' });
  for (const order of orders) {
    let changed = false;
    const items = order.get('items') || [];
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
    if (changed) {
      order.set('items', items);
      order.markModified('items');
      await order.save();
      console.log('Fixed order', order._id);
    }
  }

  const orders2 = await Order.find({ 'menuItems.status': 'pending_substitute' });
  for (const order of orders2) {
    let changed = false;
    const items = order.get('menuItems') || [];
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
    if (changed) {
      order.set('menuItems', items);
      order.markModified('menuItems');
      await order.save();
      console.log('Fixed order', order._id);
    }
  }

  process.exit(0);
}

fix();
