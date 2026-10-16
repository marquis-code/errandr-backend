const { MongoClient } = require('mongodb');

async function run() {
  const uri = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/test?retryWrites=true&w=majority&appName=errandr";
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
  });

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`Connecting attempt ${attempt}...`);
      await client.connect();
      console.log('Connected successfully!');
      const db = client.db('test');

      const user = await db.collection('users').findOne({ email: { $regex: 'toweshodocas', $options: 'i' } });
      console.log('USER:', user ? { _id: user._id, email: user.email, name: `${user.firstName} ${user.lastName}`, phone: user.phone } : 'null');

      const order = await db.collection('orders').findOne({
        $or: [
          { trackingCode: { $regex: '6F698716', $options: 'i' } },
          { customId: { $regex: '6F698716', $options: 'i' } },
          { _id: 'EXT-6F698716' },
          ...(user ? [{ customer: user._id }] : [])
        ]
      }, { sort: { createdAt: -1 } });

      console.log('ORDER:', JSON.stringify(order, null, 2));

      if (user) {
        const txs = await db.collection('transactions').find({
          $or: [
            { user: user._id },
            { customer: user._id },
            { email: { $regex: 'toweshodocas', $options: 'i' } },
            ...(order ? [{ orderId: order._id }, { reference: order.paymentReference }] : [])
          ]
        }).sort({ createdAt: -1 }).limit(5).toArray();
        console.log('TRANSACTIONS:', JSON.stringify(txs, null, 2));
      }

      await client.close();
      return;
    } catch (err) {
      console.error(`Attempt ${attempt} error:`, err.message);
      if (attempt === 3) throw err;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

run().catch(console.error);
