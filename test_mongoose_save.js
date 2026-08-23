const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/erranders');
  const db = mongoose.connection.db;

  // Since we want Mongoose validation, we need the schema.
  // Fortunately, we can compile TypeScript schema here if we use ts-node, but since ts-node is tricky, I'll just use raw mongodb update to see if it's a mongodb strictness issue. Wait, a 500 error comes from Mongoose validation.
  // Mongoose validation errors are thrown on `save()`.
  
  process.exit(0);
}
run();
