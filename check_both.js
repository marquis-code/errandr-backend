const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr';
mongoose.connect(MONGO_URI);

const OrderSchema = new mongoose.Schema({
  items: [mongoose.Schema.Types.Mixed],
  packs: [mongoose.Schema.Types.Mixed]
}, { strict: false, collection: 'orders' });

const Order = mongoose.model('Order', OrderSchema);

async function check() {
  const order = await Order.findById('6aae8af0d17115d715f52d3d');
  console.log("ITEMS:");
  console.log(JSON.stringify(order.items, null, 2));
  console.log("PACKS:");
  console.log(JSON.stringify(order.packs, null, 2));
  process.exit(0);
}

check();
