const axios = require('axios');
const mongoose = require('mongoose');

async function test() {
  await mongoose.connect('', { useNewUrlParser: true });
  const db = mongoose.connection;
  // wait we don't have to connect. The server is running locally on 3000. 
  // Let me just query it by inserting a token.
}
