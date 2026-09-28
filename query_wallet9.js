const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

async function run() {
  await mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr');
  const Product = mongoose.connection.collection('products');
  const MenuItem = mongoose.connection.collection('menuitems');
  const MenuPack = mongoose.connection.collection('menupacks');
  
  const productIds = [
    "6a8c913cb31991b1e48b91f0",
    "6a8c9125b31991b1e48b91a3",
    "6a8c91b8b31991b1e48b9356",
    "6a8c9150b31991b1e48b9238",
    "6a8c9376b31991b1e48b99b4"
  ].map(id => new ObjectId(id));
  
  const products = await Product.find({ _id: { $in: productIds } }).toArray();
  for (const p of products) {
    console.log(`Product ${p.name}: isPrepaidByPlatform = ${p.isPrepaidByPlatform}`);
  }

  const mItems = await MenuItem.find({ _id: { $in: productIds } }).toArray();
  for (const p of mItems) {
    console.log(`MenuItem ${p.name}: isPrepaidByPlatform = ${p.isPrepaidByPlatform}`);
  }

  const mPacks = await MenuPack.find({ _id: { $in: productIds } }).toArray();
  for (const p of mPacks) {
    console.log(`MenuPack ${p.name}: isPrepaidByPlatform = ${p.isPrepaidByPlatform}`);
  }

  process.exit(0);
}

run().catch(console.error);
