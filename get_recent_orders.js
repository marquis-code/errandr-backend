const mongoose = require('mongoose');

async function run() {
  try {
    await mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/erranders?retryWrites=true&w=majority&appName=errandr', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    // Find orders created in the last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const orders = await mongoose.connection.collection('orders').find({ 
      createdAt: { $gte: yesterday }
    }).sort({ createdAt: -1 }).limit(10).toArray();
    
    console.log('Recent orders:', orders.map(o => ({
      orderNumber: o.orderNumber,
      createdAt: o.createdAt,
      type: o.type,
      isGroupOrder: o.isGroupOrder,
      total: o.total,
      paymentStatus: o.paymentStatus,
      paymentReference: o.paymentReference
    })));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}
run();
