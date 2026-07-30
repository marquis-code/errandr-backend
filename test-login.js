const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function test() {
  await mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr');
  const user = await mongoose.connection.collection('users').findOne({ email: 'preciuosoba@gmail.com', role: 'student' });
  console.log('User found:', user.email);
  const isValid = await bcrypt.compare('password123', user.password);
  console.log('password123 isValid:', isValid);
  process.exit(0);
}
test();
