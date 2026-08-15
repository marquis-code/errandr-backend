const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr').then(async () => {
  const db = mongoose.connection.db;
  await db.collection('systemsettings').updateOne({ key: 'advert' }, { $set: { 'value.enabled': false } }, { upsert: true });
  console.log('Disabled advert modal');
  process.exit(0);
});
