const mongoose = require('mongoose');
require('dotenv').config();

const namesToKeep = [
  'tijani fiyinfoluwa',
  'onyekachukwu iwegbu',
  'abah marquis',
  'israel olaniran',
  'abdus-salam oyeleye',
  'al-hassan oluwaseyi',
  'halima onitiju',
  'abigail eromo-aigbehi',
  'bayiloluwato odunlami'
];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const usersCollection = mongoose.connection.collection('users');
  const errandersCollection = mongoose.connection.collection('erranders');

  // Find all errander profiles
  const erranders = await errandersCollection.find({}).toArray();
  console.log(`Total errander profiles found: ${erranders.length}`);

  let kept = 0;
  let deleted = 0;

  for (const errander of erranders) {
    const fullName = `${errander.firstName || ''} ${errander.lastName || ''}`.trim().toLowerCase();
    
    // Check if fullName matches any name in our keep list
    const shouldKeep = namesToKeep.some(keepName => {
      // Partial match or full match
      return fullName.includes(keepName) || keepName.includes(fullName);
    });

    if (shouldKeep) {
      console.log(`KEEPING: ${errander.firstName} ${errander.lastName} (${errander.email})`);
      kept++;
    } else {
      console.log(`DELETING: ${errander.firstName} ${errander.lastName} (${errander.email})`);
      await errandersCollection.deleteOne({ _id: errander._id });
      // Also delete the linked user account
      if (errander.userId || errander.user) {
        await usersCollection.deleteOne({ _id: errander.userId || errander.user });
      } else {
        await usersCollection.deleteOne({ email: errander.email });
      }
      deleted++;
    }
  }

  // Also clean up users who have role errander but no profile
  const extraUsers = await usersCollection.find({ role: 'errander' }).toArray();
  for (const user of extraUsers) {
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim().toLowerCase();
    const shouldKeep = namesToKeep.some(keepName => fullName.includes(keepName) || keepName.includes(fullName));
    
    if (!shouldKeep) {
      console.log(`DELETING EXTRA USER: ${user.firstName} ${user.lastName} (${user.email})`);
      await usersCollection.deleteOne({ _id: user._id });
      deleted++;
    }
  }

  console.log(`\nOperation complete. Kept: ${kept}, Deleted: ${deleted}`);
  await mongoose.disconnect();
}

run().catch(console.error);
