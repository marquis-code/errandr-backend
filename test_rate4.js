const { MongoClient, ObjectId } = require('mongodb');

async function test() {
    const client = new MongoClient('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr');
    await client.connect();
    const db = client.db();
    
    try {
        const orderId = "6ab6be89a70a5db8ce6d6517";
        const order = await db.collection('orders').findOne({ _id: new ObjectId(orderId) });
        console.log("Order found", order._id);
        
        // try to update order
        const result = await db.collection('orders').updateOne(
            { _id: new ObjectId(orderId) },
            { $set: { vendorRating: 5, erranderRating: 5, hasRatedVendor: true, hasRatedErrander: true } }
        );
        console.log("Updated", result.modifiedCount);
    } catch(e) {
        console.error("FAILED:", e);
    }
    process.exit(0);
}
test();
