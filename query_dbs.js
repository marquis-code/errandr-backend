const mongoose = require('mongoose');
async function main() {
  const uri = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr";
  await mongoose.connect(uri);
  const admin = mongoose.connection.db.admin();
  const list = await admin.listDatabases();
  console.log(list.databases.map(d => d.name));
  await mongoose.disconnect();
}
main().catch(console.error);
