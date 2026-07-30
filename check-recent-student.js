const mongoose = require('mongoose');

async function check() {
  await mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr');
  const UserModel = mongoose.connection.collection('users');
  const user = await UserModel.find({ role: 'student' }).sort({ updatedAt: -1 }).limit(1).toArray();
  if (user.length > 0) {
    console.log('User found:', user[0].email, 'Role:', user[0].role);
    console.log('Hash starts with:', user[0].password ? user[0].password.substring(0, 10) : 'none');
  } else {
    console.log('No student user found');
  }
  process.exit(0);
}
check();
