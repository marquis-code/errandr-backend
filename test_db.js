const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/erranders', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const db = mongoose.connection.db;
    const orders = await db.collection('orders').countDocuments();
    const dispatchers = await db.collection('erranders').countDocuments();
    console.log("Orders count:", orders);
    console.log("Dispatchers count:", dispatchers);
    mongoose.disconnect();
  });
