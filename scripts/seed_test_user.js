const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = "mongodb+srv://erranders:erranders@erranders.eknah3x.mongodb.net/?appName=erranders";

const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: { type: String, unique: true },
  password: { type: String },
  role: { type: String, default: 'student' },
  isVerified: { type: Boolean, default: true },
  walletBalance: { type: Number, default: 0 },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const passwordHash = await bcrypt.hash('Erranders2026!', 12);
    
    let user = await User.findOne({ email: 'teststudent@erranders.org' });
    if (!user) {
      user = await User.create({
        firstName: 'Test',
        lastName: 'Student',
        email: 'teststudent@erranders.org',
        password: passwordHash,
        role: 'student',
        isVerified: true,
        walletBalance: 50000
      });
      console.log('Test user created successfully!');
    } else {
      user.walletBalance = 50000;
      user.isVerified = true;
      await user.save();
      console.log('Test user already exists, updated wallet balance.');
    }

    console.log('\n--- TEST USER CREDENTIALS ---');
    console.log('Email: teststudent@erranders.org');
    console.log('Password: Erranders2026!');
    console.log('Wallet Balance: ₦50,000');
    console.log('---');

    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seed();
