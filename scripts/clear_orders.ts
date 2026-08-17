import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const OrderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: String
}, { strict: false });

const UserSchema = new mongoose.Schema({
  email: String
}, { strict: false });

const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('Connected to DB');

    const emails = ['blessingidowu1991@gmail.com', 'pontisdor@gmail.com'];
    
    for (const email of emails) {
      const user = await User.findOne({ email });
      if (!user) {
        console.log(`User not found: ${email}`);
        continue;
      }
      
      console.log(`Found user ${email} with ID ${user._id}`);
      
      const result = await Order.deleteMany({ 
        user: user._id, 
        status: { $nin: ['delivered', 'cancelled'] } 
      });
      
      console.log(`Deleted ${result.deletedCount} active orders for ${email}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected');
  }
}

run();
