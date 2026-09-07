const { MongoClient, ObjectId } = require('mongodb');

async function verify() {
  const uri = "mongodb+srv://erranders:erranders@erranders.eknah3x.mongodb.net/?appName=erranders";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('test'); // Or 'erranders' if that's the name. Let's try both or check .env

    const userEmail = 'iyachidera.vendor@erranders.org';
    const user = await db.collection('users').findOne({ email: userEmail });
    console.log('User found:', user ? { id: user._id, email: user.email } : 'Not found');

    if (user) {
      const vendors = await db.collection('vendors').find({ owner: user._id }).toArray();
      console.log('Vendors owned by this user:', vendors.map(v => ({ id: v._id, name: v.storeName, owner: v.owner })));

      if (vendors.length > 0) {
        const vendorIds = vendors.map(v => v._id);
        const orders = await db.collection('orders').find({ vendor: { $in: vendorIds } }).toArray();
        console.log('Orders for these vendors:', orders.length);
        if (orders.length > 0) {
          console.log('Sample order vendor ID:', orders[0].vendor);
        }
      }
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

verify();
