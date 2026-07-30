const mongoose = require('mongoose');

async function check() {
  await mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr');
  const UserModel = mongoose.connection.collection('users');
  const users = await UserModel.find({ email: 'abahmarquis@gmail.com' }).toArray();
  console.log('Roles found:', users.map(u => u.role));
  process.exit(0);
}
check();
