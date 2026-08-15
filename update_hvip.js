const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/erranders');
  console.log('Connected to DB');

  const vendorObj = {
    description: 'VIP Buka by HVIP Foods operates a popular food service location near the Lagos University Teaching Hospital (LUTH) and the adjacent medical academic areas. It provides local dine-in, take-out, and delivery options popular with students and staff. 🍽️ Dine in || 🥡 Take-out || 👨🏽‍🍳 Catering Services || 🛵 Delivery',
    address: 'LUTH Branch (close to Idi-Araba medical campus)',
    openingTime: '12:00 PM',
    closingTime: '10:00 PM'
  };

  const result = await mongoose.connection.collection('vendors').updateMany(
    { storeName: 'HVIP FOODS' },
    { $set: vendorObj }
  );
  console.log(`Updated ${result.modifiedCount} vendors for "HVIP FOODS"`);

  const userResult = await mongoose.connection.collection('users').updateMany(
    { email: 'hvipfoods@vendor.com' },
    { $set: { phoneNumber: '07059653297' } }
  );
  console.log(`Updated ${userResult.modifiedCount} users for "hvipfoods@vendor.com"`);

  await mongoose.disconnect();
  console.log('Done');
}

run().catch(console.error);
