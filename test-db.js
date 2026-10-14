const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr').then(async () => {
  const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false }));
  const order = await Order.findById('6aca30aaf7ab844fe2864a32');
  console.log(JSON.stringify(order, null, 2));
  process.exit(0);
});
