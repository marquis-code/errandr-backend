const { MongoClient } = require('mongodb');

async function run() {
  const uri = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('test'); // Or whatever the active DB is
    
    // Find Daniel
    const user = await db.collection('users').findOne({ email: 'danielomolaja83@gmail.com' });
    if (!user) {
      console.log("User not found.");
      return;
    }
    
    console.log(`Found user: ${user._id}`);
    
    // Get start of today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    
    const orders = await db.collection('orders').find({
      $or: [
        { customer: user._id },
        { user: user._id }
      ],
      createdAt: { $gte: startOfToday }
    }).toArray();
    
    console.log(`Found ${orders.length} standard orders today:`);
    orders.forEach(o => {
      console.log(`- Order: ${o.orderNumber}, Status: ${o.status}, Type: ${o.type}, Date: ${o.createdAt}`);
    });
    
    const groupOrders = await db.collection('grouporders').find({
      host: user._id,
      createdAt: { $gte: startOfToday }
    }).toArray();
    
    console.log(`Found ${groupOrders.length} group orders today hosted by user:`);
    groupOrders.forEach(o => {
      console.log(`- Group Order: ${o.inviteCode}, Status: ${o.status}, Date: ${o.createdAt}, packs/participants: ${o.participants?.length}`);
    });

  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

run();
