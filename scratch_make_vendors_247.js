const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const vendors = mongoose.connection.collection('vendors');

  const allVendors = await vendors.find({}).toArray();
  
  const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const fullHours = allDays.map(day => ({
    day,
    open: '00:00',
    close: '23:59',
    isClosed: false,
    _id: new mongoose.Types.ObjectId()
  }));

  for (const v of allVendors) {
    await vendors.updateOne(
      { _id: v._id },
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
  }

  console.log(`Updated ${allVendors.length} vendors to 24/7.`);
  process.exit(0);
}
run().catch(console.error);
