require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await mongoose.connection.db.collection('users').findOne({ email: 'admin@erranders.org' });
  
  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'erranders_secret');
  
  const start = Date.now();
  try {
    const res = await axios.get('http://localhost:3005/api/v1/admin/dispatchers?page=1&limit=10', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Success! Count:', res.data.dispatchers.length);
  } catch (e) {
    console.error('Error:', e.message);
  }
  console.log('Time:', Date.now() - start, 'ms');
  process.exit(0);
}
run();
