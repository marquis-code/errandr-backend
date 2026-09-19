import mongoose from 'mongoose';

// Connect to MongoDB
const MONGO_URI = 'mongodb+srv://developer:fI5YpYlIq806R4B4@production.d3npx.mongodb.net/production?retryWrites=true&w=majority';
mongoose.connect(MONGO_URI);

const OrderSchema = new mongoose.Schema({
  items: [mongoose.Schema.Types.Mixed]
}, { strict: false, collection: 'orders' });

const Order = mongoose.model('Order', OrderSchema);

async function fix() {
  const orders = await Order.find({ 'items.status': 'pending_substitute' });
  for (const order of orders) {
    let changed = false;
    const items = order.get('items') || [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].status === 'pending_substitute' && !items[i].substituteOptions) {
        // Find notification or something?
        // Actually, just set a dummy option so they can resume and decline, or test it
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
      await order.save();
      console.log('Fixed order', order._id);
    }
  }
  process.exit(0);
}

fix();
