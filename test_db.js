const { MongoClient, ObjectId } = require('mongodb');
async function test() {
    const client = new MongoClient('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr');
    await client.connect();
    const db = client.db();
    const order = await db.collection('orders').findOne({ _id: new ObjectId("6ab6be89a70a5db8ce6d6517") });
    console.log("subtotal:", order.subtotal);
    console.log("total:", order.total);
    console.log("deliveryFee:", order.deliveryFee);
    console.log("hasRatedVendor:", order.hasRatedVendor);
    process.exit(0);
}
test();
