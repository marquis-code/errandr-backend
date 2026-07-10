const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr').then(async () => {
  const vendor = await mongoose.connection.collection('vendors').findOne({ _id: new mongoose.Types.ObjectId("6a5095af1427cb6762f0cb31") });
  console.log("VENDOR:", JSON.stringify({ isOnline: vendor.isOnline, status: vendor.status }));
  const searchResults = await mongoose.connection.collection('vendors').find({ 
    storeName: { $regex: 'adewale', $options: 'i' } 
  }).toArray();
  console.log("SEARCH:", searchResults.map(v => ({ name: v.storeName, isOnline: v.isOnline, status: v.status })));
  process.exit(0);
});
