import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const UserSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);
    const user = await User.findOne({ email: 'ahmedthompson79@gmail.com' });
    console.log(JSON.stringify(user, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

run();
