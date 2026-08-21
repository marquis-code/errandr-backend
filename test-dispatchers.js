const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr')
  .then(async () => {
    const db = mongoose.connection.db;
    const count = await db.collection('erranders').countDocuments();
    const dispatchers = await db.collection('erranders').find({}).limit(2).toArray();
    console.log('Count:', count);
    console.log('Sample:', dispatchers);
    process.exit(0);
  }).catch(e => {
    console.error(e);
    process.exit(1);
  });
