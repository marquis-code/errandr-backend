const mongoose = require("mongoose");
const uri = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr";

async function run() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const users = db.collection("users");
  const user = await users.findOne({ email: "abahmarquis@gmail.com" });
  console.log(JSON.stringify(user, null, 2));
  await mongoose.disconnect();
}
run().catch(console.dir);
