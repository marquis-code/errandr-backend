import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

const fix = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);
    const db = mongoose.connection.db;

    if (!db) {
      throw new Error("No db connection");
    }

    // Find services that have vendorId instead of vendor
    const servicesToFix = await db.collection('services').find({ vendorId: { $exists: true } }).toArray();
    console.log(`Found ${servicesToFix.length} services to fix.`);

    for (const service of servicesToFix) {
      await db.collection('services').updateOne(
        { _id: service._id },
        { 
          $set: { 
            vendor: service.vendorId,
            isAvailable: true 
          },
          $unset: {
            vendorId: "",
            isActive: ""
          }
        }
      );
    }
    console.log('Fixed services successfully.');

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

fix();
