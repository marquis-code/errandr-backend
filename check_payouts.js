const { MongoClient } = require('mongodb');

async function main() {
    const uri = process.env.MONGODB_URI || "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr";
    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db('test'); // usually test or errandr, let's list collections
        const collections = await db.listCollections().toArray();
        console.log("Collections:", collections.map(c => c.name));
        
        // Let's assume the db name is errandr? The URI doesn't specify a db (except test by default).
        // Let's check transactions or payouts.
        if (collections.some(c => c.name === 'payouts')) {
            const payouts = await db.collection('payouts').find().sort({createdAt: -1, date: -1}).limit(20).toArray();
            console.log("\nRecent Payouts:", JSON.stringify(payouts, null, 2));
        } else if (collections.some(c => c.name === 'transactions')) {
            const txs = await db.collection('transactions').find({ type: { $regex: /payout/i } }).sort({createdAt: -1, date: -1}).limit(20).toArray();
            console.log("\nRecent Payout Transactions:", JSON.stringify(txs, null, 2));
        }
    } finally {
        await client.close();
    }
}

main().catch(console.error);
