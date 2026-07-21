const mongoose = require('mongoose');
const uri = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr";

async function run() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const user = await db.collection('users').findOne({ email: 'titexas313@rapplo.com' });
  if (!user) {
    console.log("User not found");
    process.exit();
  }
  console.log("User:", user);
  const vendor = await db.collection('vendors').findOne({ owner: user._id });
  console.log("Vendor:", vendor);
  process.exit();
}
run().catch(console.error);
