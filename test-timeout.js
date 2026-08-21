require('dotenv').config({ path: __dirname + '/.env' });
const axios = require('axios');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await mongoose.connection.db.collection('users').findOne({ email: 'admin@erranders.org' });
  
  if (!user) {
    console.log("No admin user found.");
    process.exit(1);
  }
  
  const token = jwt.sign(
    { sub: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  console.log("Token generated, testing endpoint...");
  const start = Date.now();
  try {
    const res = await axios.get('http://localhost:3005/api/v1/admin/dispatchers?page=1&limit=100', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`Success! Time: ${Date.now() - start}ms, Count: ${res.data.dispatchers.length}`);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    if (err.response) {
      console.error(`Response body:`, err.response.data);
    }
  }
  process.exit(0);
}
run();
