import mongoose from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/erranders';
const TARGET_EMAIL = 'achuekonah@gmail.com';
const NEW_PASSWORD = 'password123';

async function resetPassword() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to DB');

    const userModel = mongoose.connection.collection('users');
    const user = await userModel.findOne({ email: TARGET_EMAIL });
    
    if (user) {
      const hashedPassword = await bcrypt.hash(NEW_PASSWORD, 10);
      await userModel.updateOne(
        { email: TARGET_EMAIL },
        { $set: { password: hashedPassword } }
      );
      console.log(`Password for ${TARGET_EMAIL} successfully reset to: ${NEW_PASSWORD}`);
    } else {
      console.log(`User ${TARGET_EMAIL} not found.`);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

resetPassword();
