const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr').then(async () => {
  const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false }));
  const Vendor = mongoose.model('Vendor', new mongoose.Schema({}, { strict: false }));
  const Errander = mongoose.model('Errander', new mongoose.Schema({}, { strict: false }));
  
  const order = await Order.findById('6aca30aaf7ab844fe2864a32');
  console.log('Found order:', order ? order._id : 'null');
  
  // mock updating order logic
  try {
    const updateRes = await Order.updateOne(
      { _id: order._id },
      { $set: { hasRatedVendor: true, vendorRating: 5 } }
    );
    console.log('Update result:', updateRes);
  } catch (e) {
    console.error('Update error:', e.message);
  }
  process.exit(0);
});
