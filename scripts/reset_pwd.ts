import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const UserSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);
    const hashedPassword = await bcrypt.hash('Password123!', 12);
    const result = await User.updateOne(
      { email: 'ahmedthompson79@gmail.com' },
      { $set: { password: hashedPassword } }
    );
    console.log(`Matched ${result.matchedCount}, Modified ${result.modifiedCount}`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

run();
