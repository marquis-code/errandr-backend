const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr').then(async () => {
  const vendor = await mongoose.connection.collection('vendors').findOne({ storeName: /chips/i });
  console.log(vendor ? { storeName: vendor.storeName, preOrderOnly: vendor.preOrderOnly } : 'Not found');
  process.exit(0);
});
