const mongoose = require('mongoose');

async function main() {
  await mongoose.connect('mongodb://localhost:27017/erranders');
  console.log("Connected to MongoDB");

  const reports = await mongoose.connection.db.collection('reports').find().toArray();
  console.log(`Total reports: ${reports.length}`);
  console.log(reports);
  
  process.exit(0);
}

main().catch(console.error);
