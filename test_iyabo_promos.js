const mongoose = require('mongoose');
async function run() {
  await mongoose.connect("mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr");
  const vendorId = "6a8586daab029f6a5d48939c"; // Iyabo
  const packs = await mongoose.connection.db.collection('menupacks').find({ vendorId: new mongoose.Types.ObjectId(vendorId), isPrepaidByPlatform: true }).toArray();
  console.log('menupacks:', packs.map(p => ({name: p.name, budget: p.budgetPerOrder, max: p.maxOrders})));
  
  const products = await mongoose.connection.db.collection('products').find({ vendor: new mongoose.Types.ObjectId(vendorId), isPrepaidByPlatform: true }).toArray();
  console.log('products:', products.map(p => ({name: p.name, max: p.maxOrders})));
  
  process.exit(0);
}
run();
