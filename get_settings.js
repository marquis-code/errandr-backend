const mongoose = require('mongoose');
async function checkSettings() {
  const uri = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr";
  await mongoose.connect(uri);
  const Setting = mongoose.connection.db.collection('settings');
  const customErrand = await Setting.findOne({ key: 'custom_errand' });
  console.log(JSON.stringify(customErrand, null, 2));
  await mongoose.disconnect();
}
checkSettings().catch(console.error);
