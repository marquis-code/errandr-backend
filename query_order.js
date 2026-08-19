const mongoose = require('mongoose');

async function checkOrder() {
  const uri = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr";
  await mongoose.connect(uri);
  const db = mongoose.connection.useDb('test'); // Or whatever the DB name is, usually the default is used. Let's just list collections.
  
  const Order = mongoose.connection.db.collection('orders');
  const order = await Order.findOne({ orderNumber: { $regex: '9AAF98D4', $options: 'i' } });
  
  if (order) {
    console.log(JSON.stringify(order, null, 2));
  } else {
    console.log("Order not found");
  }
  await mongoose.disconnect();
}
checkOrder().catch(console.error);
