const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr');
  const orderModel = mongoose.connection.collection('orders');
  const productModel = mongoose.connection.collection('products');
  
  const badOrder = await orderModel.findOne({ orderNumber: 'ERR-57F7E57A' });
  
  const productIds = [];
  if (badOrder.packs) {
    for (const pack of badOrder.packs) {
      for (const item of pack.items) {
         if (item.product) productIds.push(item.product);
      }
    }
  }
  
  const products = await productModel.find({ _id: { $in: productIds } }).toArray();
  for (const p of products) {
    console.log(`Product ${p.name}: isPrepaidByPlatform = ${p.isPrepaidByPlatform}`);
  }

  process.exit(0);
}

run().catch(console.error);
