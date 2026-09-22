const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
}, { collection: 'users' });

const User = mongoose.model('User', userSchema);

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);

    // Find the user by email
    const user = await User.findOne({ email: 'mariamomotayo915@gmail.com' });
    if (!user) {
      console.log('User not found.');
      return;
    }

    // The original password hash before we changed it
    const originalHash = '$2a$12$UARhuTyLZ38zCRqKT/rHg.69uvkS3VQn3T8YgK75QkGPxsXvi04G6';

    // Update the password back to the original hash
    user.password = originalHash;
    await user.save();

    console.log('\n--- Vendor Password Reverted ---');
    console.log(`Email: ${user.email}`);
    console.log(`Password successfully restored to the original hash.`);
    console.log('--------------------------------\n');

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

main();
