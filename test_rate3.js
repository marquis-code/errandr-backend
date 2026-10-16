const { MongoClient, ObjectId } = require('mongodb');

async function test() {
    const client = new MongoClient('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr');
    await client.connect();
    const db = client.db();
    
    // Attempt exactly what the code does
    const orderId = "6ab6be89a70a5db8ce6d6517";
    const data = {"rating":5,"review":"","vendorRating":5,"erranderRating":5};
    
    try {
        const order = await db.collection('orders').findOne({ _id: new ObjectId(orderId) });
        if (!order) throw new Error('Order not found');

        if (data.vendorRating) {
            if (order.hasRatedVendor) throw new Error('Vendor already rated');
            if (order.vendor) {
                const vendorId = (order.vendor._id ? order.vendor._id.toString() : order.vendor.toString());
                const vendor = await db.collection('vendors').findOne({ _id: new ObjectId(vendorId) });
                
                const currentRating = vendor.rating || 5.0; // Default to 5.0 if not set
                const totalRatings = vendor.totalRatings || 0;
                const newTotalRatings = totalRatings + 1;

                vendor.rating = ((currentRating * totalRatings) + data.vendorRating) / newTotalRatings;
                vendor.totalRatings = newTotalRatings;
                console.log("VENDOR UPDATE:", vendor.rating, vendor.totalRatings);
            }
        }
        
        if (data.erranderRating) {
            let resolvedErranderUserId = null;
            if (order.errander) {
                const erranderRef = (order.errander._id ? order.errander._id.toString() : order.errander.toString());
                resolvedErranderUserId = erranderRef;
                let errander = await db.collection('erranders').findOne({ user: new ObjectId(erranderRef) });
                if (!errander) {
                   errander = await db.collection('erranders').findOne({ _id: new ObjectId(erranderRef) });
                   if (errander && errander.user) resolvedErranderUserId = errander.user._id ? errander.user._id.toString() : errander.user.toString();
                }
                
                if (errander) {
                  const currentRating = errander.rating || 0;
                  const deliveries = errander.totalDeliveries || 1;
                  errander.rating = ((currentRating * (deliveries - 1)) + data.erranderRating) / deliveries;
                  console.log("ERRANDER UPDATE:", errander.rating);
                }
            }
        }
        
    } catch(e) {
        console.error("FAILED:", e);
    }
    process.exit(0);
}
test();
