const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/erranders').then(async () => {
  const db = mongoose.connection.db;
  const messages = await db.collection('chatmessages').find({ roomType: 'direct' }).sort({ createdAt: -1 }).limit(5).toArray();
  console.log(JSON.stringify(messages, null, 2));
  process.exit(0);
});
