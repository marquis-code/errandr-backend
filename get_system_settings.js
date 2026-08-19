const mongoose = require('mongoose');
async function checkSettings() {
  const uri = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr";
  await mongoose.connect(uri);
  const Setting = mongoose.connection.db.collection('systemsettings');
  const all = await Setting.find({ key: 'custom_errand' }).toArray();
  console.log(JSON.stringify(all, null, 2));
  await mongoose.disconnect();
}
checkSettings().catch(console.error);
