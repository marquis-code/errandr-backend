const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/erranders', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const db = mongoose.connection.db;
    const start = Date.now();
    const count = await db.collection('erranders').countDocuments();
    console.log('Count:', count, 'Time:', Date.now() - start, 'ms');
    process.exit(0);
  });
