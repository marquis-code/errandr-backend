import mongoose from 'mongoose';
async function run() {
  await mongoose.connect('mongodb://localhost:27017/test'); // or whatever the DB name is, wait it's test? Yes, "test.favorites"
  try {
    await mongoose.connection.collection('favorites').dropIndex('user_1_product_1');
    console.log('Successfully dropped old user_1_product_1 index');
  } catch (e) {
    console.log('Index drop error (user_1_product_1):', e.message);
  }
  try {
    await mongoose.connection.collection('favorites').dropIndex('user_1_vendor_1');
    console.log('Successfully dropped old user_1_vendor_1 index');
  } catch (e) {
    console.log('Index drop error (user_1_vendor_1):', e.message);
  }
  await mongoose.disconnect();
}
run();
