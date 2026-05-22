import * as mongoose from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { UserRole } from '../src/modules/users/schemas/user.schema';

const MONGODB_URI = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr";

const userData = {
  firstName: 'Erranders',
  lastName: 'Admin',
  email: 'abahmarquis@gmail.com',
  password: 'Admin@123',
  role: UserRole.ADMIN,
  isVerified: true,
  isActive: true,
};

async function seedAdmin() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected.');

    const UserSchema = new mongoose.Schema({
      firstName: String,
      lastName: String,
      email: { type: String, unique: true },
      password: String,
      role: String,
      isVerified: Boolean,
      isActive: Boolean,
    }, { timestamps: true });

    const User = mongoose.model('User', UserSchema);

    // Check if user exists
    const existingUser = await User.findOne({ email: userData.email });
    
    if (existingUser) {
      console.log('Admin user already exists. Updating password...');
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      await User.updateOne({ email: userData.email }, { password: hashedPassword, role: UserRole.ADMIN, isVerified: true });
      console.log('Admin updated successfully.');
    } else {
      console.log('Creating admin user...');
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const user = new User({
        ...userData,
        password: hashedPassword,
      });
      await user.save();
      console.log('Admin created successfully.');
    }

    await mongoose.disconnect();
    console.log('Done.');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seedAdmin();
