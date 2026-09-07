const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/test?retryWrites=true&w=majority&appName=errandr', { useNewUrlParser: true, useUnifiedTopology: true });
  
  const vendor = await mongoose.connection.collection('vendors').findOne({ storeName: /Chips by Motee/i });
  if (vendor && vendor.packs && vendor.packs.length > 0) {
    await mongoose.connection.collection('vendors').updateOne(
      { _id: vendor._id },
      { $set: { "packs.0.price": 0, packagingFee: 0 } }
    );
    console.log("Updated Motee packs price to 0");
  } else {
    console.log("Motee not found or no packs array");
  }
  process.exit(0);
}
run();
