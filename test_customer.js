const { MongoClient, ObjectId } = require('mongodb');
async function test() {
    const client = new MongoClient('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr');
    await client.connect();
    const db = client.db();
    const user = await db.collection('users').findOne({ _id: new ObjectId("6a26f7ddafbcb547fd7b3c67") });
    console.log(user ? "User exists" : "User NOT FOUND");
    process.exit(0);
}
test();
