const axios = require('axios');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const db = mongoose.connection.db;
    const vendor = await db.collection('vendors').findOne({ storeName: /Iyabo/i });
    if (!vendor) {
      console.log('Vendor not found');
      process.exit(0);
    }
    
    // Login as a user to get token, or we can just mock a token or call the service directly
    // Let's just directly call the service logic instead
    process.exit(0);
  });
