const mongoose = require('mongoose');
async function run() {
  await mongoose.connect("mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr");
  const vendors = mongoose.connection.db.collection('vendors');
  const res = await vendors.find({ 'prepaidPromo.enabled': true }).toArray();
  for (let v of res) {
    const max = v.prepaidPromo.maxOrders || 0;
    const used = v.prepaidPromo.usedOrders || 0;
    console.log(`${v.storeName}: Max ${max}, Used ${used}, Remaining ${max - used}`);
  }
  process.exit(0);
}
run();
