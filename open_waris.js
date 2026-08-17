const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/erranders');
  const vendors = mongoose.connection.collection('vendors');

  const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const fullHours = allDays.map(day => ({
    day,
    open: '00:00',
    close: '23:59',
    isClosed: false,
    _id: new mongoose.Types.ObjectId()
  }));

  const result = await vendors.updateOne(
    { name: { $regex: /Waris Kitchen/i } },
    {
      $set: {
        businessHours: fullHours,
        isOnline: true,
        isOpen: true,
        'breakPeriod.enabled': false,
        openingTime: '12:00 AM',
        closingTime: '11:59 PM'
      }
    }
  );

  console.log(`Updated Waris Kitchen: ${result.modifiedCount} modified.`);
  process.exit(0);
}

run().catch(console.error);
