const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/erranders?retryWrites=true&w=majority&appName=errandr');
const db = mongoose.connection;
db.once('open', async function() {
  const collection = db.collection('orders');
  const order = await collection.findOne({ orderNumber: 'ERR-1791664789883-221' });
  console.log(JSON.stringify(order, null, 2));
  process.exit(0);
});
