const mongoose = require('mongoose');

async function run() {
  try {
    await mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    // Check 'test' database (the default when no DB is provided in URI)
    const order = await mongoose.connection.collection('orders').findOne({ 
      $or: [
        { orderNumber: 'ERR-1791664789883-221' },
        { paymentReference: 'ERR-1791664789883-221' },
        { groupId: 'ERR-1791664789883-221' },
        { orderNumber: { $regex: /1791664789883/ } }
      ]
    });
    
    if (order) {
      console.log(JSON.stringify({ 
        orderNumber: order.orderNumber,
        type: order.type,
        isGroupOrder: order.isGroupOrder,
        items: order.items, 
        menuItems: order.menuItems, 
        packs: order.packs, 
        customDetails: order.customDetails 
      }, null, 2));
    } else {
      console.log('Order still not found in test db');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}
run();
