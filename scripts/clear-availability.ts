import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI;

async function clearAvailability() {
  if (!MONGO_URI) throw new Error('Missing MONGODB_URI');
  try {
    console.log('Connecting...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected.');

    const db = mongoose.connection.db;
    if (db) {
      const result = await db.collection('appointments').deleteMany({});
      console.log(`Deleted ${result.deletedCount} appointments.`);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

clearAvailability();
