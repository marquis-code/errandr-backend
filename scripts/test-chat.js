const axios = require('axios');
const mongoose = require('mongoose');

async function test() {
  await mongoose.connect('mongodb+srv://developer:7K4jN0m2ZkVg3uR@cluster0.a1b2c.mongodb.net/erranders?retryWrites=true&w=majority', { useNewUrlParser: true });
  const db = mongoose.connection;
  // wait we don't have to connect. The server is running locally on 3000. 
  // Let me just query it by inserting a token.
}
