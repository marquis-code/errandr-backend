const { MongoClient, ObjectId } = require('mongodb');
async function test() {
    const client = new MongoClient('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr');
    await client.connect();
    const db = client.db();
    const user = await db.collection('erranders').findOne({ user: new ObjectId("6ab6bac0a70a5db8ce6cf913") });
    console.log(user ? "Errander exists" : "Errander NOT FOUND");
    process.exit(0);
}
test();
