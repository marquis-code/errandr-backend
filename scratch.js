const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr').then(async () => {
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false }));
  const user = await User.findOne({ email: 'danielomolaja83@gmail.com' });
  if (!user) {
    console.log('User not found');
    process.exit(0);
  }
  const orders = await Order.find({ customer: user._id }); // just get all orders for simplicity
  console.log(JSON.stringify(orders, null, 2));
  process.exit(0);
});
