const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr');

const OrderSchema = new mongoose.Schema({ vendor: mongoose.Schema.Types.ObjectId, status: String }, { strict: false });
const Order = mongoose.model('Order', OrderSchema);

const VendorSchema = new mongoose.Schema({ totalOrders: Number }, { strict: false });
const Vendor = mongoose.model('Vendor', VendorSchema);

async function run() {
  try {
    const vendors = await Vendor.find();
    for (const vendor of vendors) {
      // Find all delivered orders for this vendor
      const count = await Order.countDocuments({ vendor: vendor._id, status: 'delivered' });
      await Vendor.updateOne({ _id: vendor._id }, { $set: { totalOrders: count } });
      console.log(`Updated ${vendor._id} with ${count} orders`);
    }
    console.log('Finished syncing total orders.');
  } catch(e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
}
run();
