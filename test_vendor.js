const { MongoClient, ObjectId } = require('mongodb');
async function test() {
    const client = new MongoClient('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr');
    await client.connect();
    const db = client.db();
    const vendor = await db.collection('vendors').findOne({ _id: new ObjectId("6a8007f69e88731e217c37cb") });
    console.log(vendor ? "Vendor exists" : "Vendor NOT FOUND");
    process.exit(0);
}
test();
