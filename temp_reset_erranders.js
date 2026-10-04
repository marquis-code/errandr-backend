const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // common in Nest/Express apps; we will fallback if it fails

async function main() {
  const uri = 'mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr';
  
  try {
    await mongoose.connect(uri);
    // Usually the model is 'User', collection 'users'
    const db = mongoose.connection.db;
    const users = db.collection('users');
    
    let user = await users.findOne({ email: /mariamomotayo915/i });
    if (user) {
      console.log('Found user:', user.email);
      let hash;
      try {
        const bcrypt = require('bcrypt'); // try bcrypt if bcryptjs is not there
        hash = await bcrypt.hash('Temporary123!', 10);
      } catch (e) {
        try {
          const bcryptjs = require('bcryptjs');
          hash = await bcryptjs.hash('Temporary123!', 10);
        } catch (err) {
          throw new Error('No bcrypt or bcryptjs found');
        }
      }
      
      await users.updateOne({ _id: user._id }, { $set: { password: hash, passwordHash: hash } });
      console.log('Password reset to Temporary123!');
    } else {
      console.log('User not found. Creating temporary user.');
      let hash;
      try {
        const bcrypt = require('bcrypt');
        hash = await bcrypt.hash('Temporary123!', 10);
      } catch (e) {
        const bcryptjs = require('bcryptjs');
        hash = await bcryptjs.hash('Temporary123!', 10);
      }
      
      await users.insertOne({
        email: 'mariamomotayo915@gmail.com',
        firstName: 'Maria',
        lastName: 'Momotayo',
        password: hash,
        passwordHash: hash,
        role: 'admin',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('User created with Temporary123!');
    }
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
}
main();
