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
].map(n => n.toLowerCase().trim().replace(/\s+/g, ' ')); // Normalize spaces in our list

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const usersCollection = mongoose.connection.collection('users');
  const errandersCollection = mongoose.connection.collection('erranders');

  const erranderUsers = await usersCollection.find({ role: 'errander' }).toArray();
  console.log(`Total errander users found: ${erranderUsers.length}`);

  let kept = 0;
  let deleted = 0;

  for (const user of erranderUsers) {
    const rawFullName = `${user.firstName || ''} ${user.lastName || ''}`;
    // Normalize user's full name (replace double spaces, trim)
    const fullName = rawFullName.replace(/\s+/g, ' ').trim().toLowerCase();
    
    // Check if fullName matches any name in our keep list
    const shouldKeep = namesToKeep.some(keepName => {
      return fullName.includes(keepName) || keepName.includes(fullName);
    });

    if (shouldKeep) {
      console.log(`KEEPING: ${user.firstName} ${user.lastName} (${user.email})`);
      kept++;
    } else {
      console.log(`DELETING: ${user.firstName} ${user.lastName} (${user.email})`);
      await usersCollection.deleteOne({ _id: user._id });
      // Delete associated errander profile
      await errandersCollection.deleteOne({ user: user._id });
      deleted++;
    }
  }

  console.log(`\nOperation complete. Kept: ${kept}, Deleted: ${deleted}`);
  await mongoose.disconnect();
}

run().catch(console.error);
