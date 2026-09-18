const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const db = mongoose.connection.db;
    const order = await db.collection('orders').findOne({ _id: new mongoose.Types.ObjectId('6aada1d8442ea7f13d9a2c1d') });
    console.log(JSON.stringify(order.menuItems, null, 2));
    process.exit(0);
  });
