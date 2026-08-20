const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/test?retryWrites=true&w=majority&appName=errandr', { useNewUrlParser: true, useUnifiedTopology: true });
  
  const vendor = await mongoose.connection.collection('vendors').findOne({ storeName: /Chips by Motee/i });
  console.log(vendor);
  process.exit(0);
}
run();
