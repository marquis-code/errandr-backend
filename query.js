const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr');

const UserSchema = new mongoose.Schema({ email: String, password: String, firstName: String, lastName: String }, { strict: false });
const User = mongoose.model('User', UserSchema);

async function run() {
  const user = await User.findOne({ email: 'waliatmobolaji909@gmail.com' });
  console.log(user);
  process.exit(0);
}
run();
