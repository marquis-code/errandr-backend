const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr');
  const Order = mongoose.connection.collection('orders');

  const fullOrder = await Order.findOne({ orderNumber: 'ERR-57F7E57A' });
  console.log('Packs:', JSON.stringify(fullOrder.packs, null, 2));
  
  process.exit(0);
}

run().catch(console.error);
