const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/erranders');
  const db = mongoose.connection;
  const MenuItem = db.collection('menuitems');
  const item = await MenuItem.findOne({ _id: new mongoose.Types.ObjectId("6a6134adc5efa13af6cb82cf") });
  console.log("MenuItem:", item);

  const Product = db.collection('products');
  const prod = await Product.findOne({ _id: new mongoose.Types.ObjectId("6a6134adc5efa13af6cb82cf") });
  console.log("Product:", prod);

  process.exit(0);
}
run();
