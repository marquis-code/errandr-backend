const mongoose = require('mongoose');

const MONGODB_URI = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr";

const userSchema = new mongoose.Schema({
  email: String
}, { strict: false });

const vendorSchema = new mongoose.Schema({
  owner: mongoose.Schema.Types.ObjectId,
  storeName: String,
  businessName: String
}, { strict: false });

const orderSchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.Mixed }
}, { strict: false });

async function clearOrders() {
  try {
    await mongoose.connect(MONGODB_URI);
    
    const User = mongoose.model('User', userSchema, 'users');
    const Vendor = mongoose.model('Vendor', vendorSchema, 'vendors');
    const Order = mongoose.model('Order', orderSchema, 'orders');

    const email = 'blessingidowu1991@gmail.com';
    const user = await User.findOne({ email });

    if (!user) {
      console.log(`User with email ${email} not found.`);
      process.exit(0);
    }

    console.log(`Found user: ${user._id}`);
    
    const vendor = await Vendor.findOne({ owner: user._id });
    
    if (vendor) {
       console.log(`Found vendor: ${vendor._id} - ${vendor.storeName || vendor.businessName}`);
       
       const orders = await Order.find({ vendor: vendor._id });
       console.log(`Found ${orders.length} orders matching ObjectId for this vendor.`);
       
       const orders2 = await Order.find({ vendor: vendor._id.toString() });
       console.log(`Found ${orders2.length} orders matching String for this vendor.`);
       
       const allOrders = [...orders, ...orders2];
       if (allOrders.length > 0) {
         const res = await Order.deleteMany({ vendor: { $in: [vendor._id, vendor._id.toString()] } });
         console.log(`Deleted ${res.deletedCount} orders!`);
       }
    } else {
       console.log('No vendor found for this user in vendors collection.');
       
       // Just list some vendors to see what's in the DB
       const someVendors = await Vendor.find().limit(5);
       console.log('Sample vendors:', someVendors.map(v => v.storeName || v.businessName));
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

clearOrders();
