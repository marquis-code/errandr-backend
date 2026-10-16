const mongoose = require('mongoose');

async function run() {
  try {
    await mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/erranders?retryWrites=true&w=majority&appName=errandr', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    const count = await mongoose.connection.collection('orders').countDocuments();
    const orders = await mongoose.connection.collection('orders').find({}).sort({ _id: -1 }).limit(5).toArray();
    
    console.log('Total orders:', count);
    if (orders.length > 0) {
      console.log('Latest orders:', orders.map(o => ({ orderNumber: o.orderNumber, createdAt: o.createdAt })));
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}
run();
