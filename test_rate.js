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
                console.log('vendor', vendor);
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
                console.log('errander', errander);
                console.log('resolvedErranderUserId', resolvedErranderUserId);
            }
        }
        
        if (order.customer) {
            const customerId = (order.customer._id ? order.customer._id.toString() : order.customer.toString());
            console.log('customerId', customerId);
            const actualDeliveryTime = order.actualDeliveryTime;
            const ratingDelay = actualDeliveryTime ? (Date.now() - new Date(actualDeliveryTime).getTime()) / 60000 : Infinity;
            console.log('ratingDelay', ratingDelay);
        }
    } catch(e) {
        console.error("FAILED:", e);
    }
    process.exit(0);
}
test();
