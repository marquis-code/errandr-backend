const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected');
  
  const item = await mongoose.connection.collection('menuitems').findOne({});
  console.log('MenuItem:', JSON.stringify(item, null, 2));
  
  const category = await mongoose.connection.collection('menucategories').findOne({ _id: item.categoryId });
  console.log('Category:', category);

  process.exit(0);
}
run();
