const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // Assuming bcryptjs or bcrypt is installed in backend
mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr');

const UserSchema = new mongoose.Schema({ email: String, password: String }, { strict: false });
const User = mongoose.model('User', UserSchema);

async function run() {
  try {
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash('password123', salt);
    await User.updateOne({ email: 'waliatmobolaji909@gmail.com' }, { $set: { password: hashedPassword } });
    console.log('Password reset successful');
  } catch(e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
}
run();
