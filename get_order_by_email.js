const mongoose = require('mongoose');

async function run() {
  try {
    await mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/erranders?retryWrites=true&w=majority&appName=errandr', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    const user = await mongoose.connection.collection('users').findOne({ email: 'danielomolaja83@gmail.com' });
    if (!user) {
      console.log('User danielomolaja83@gmail.com not found');
      return;
    }
    console.log('User found:', user._id);
    
    const orders = await mongoose.connection.collection('orders').find({ customer: user._id }).sort({ createdAt: -1 }).limit(3).toArray();
    if (orders.length > 0) {
      console.log('Recent orders:', JSON.stringify(orders.map(o => ({
        orderNumber: o.orderNumber,
        type: o.type,
        isGroupOrder: o.isGroupOrder,
        items: o.items,
        paymentReference: o.paymentReference
      })), null, 2));
    } else {
      console.log('No orders found for user');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}
run();
