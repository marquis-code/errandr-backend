import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

const vendorName = 'Glamour Nails by Sarah';

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);
    const db = mongoose.connection.db;

    if (!db) {
      throw new Error("No db connection");
    }

    const vendor = await db.collection('vendors').findOne({ storeName: vendorName });
    if (!vendor) {
      console.log(`Vendor ${vendorName} not found`);
      process.exit(1);
    }
    
    console.log(`Found vendor: ${vendor._id}`);

    const newServices = [
      {
        vendorId: vendor._id,
        name: 'Deluxe Spa Pedicure',
        description: 'A luxurious pedicure treatment that includes a relaxing foot soak, exfoliation, mask, hot towel wrap, and a soothing massage. Finished with your choice of regular or gel polish.',
        price: 15000,
        durationInMinutes: 60,
        category: 'Pedicures',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        vendorId: vendor._id,
        name: 'Classic Gel Manicure',
        description: 'Complete cuticle care, nail shaping, and a flawless gel polish application that lasts up to 2 weeks without chipping.',
        price: 8000,
        durationInMinutes: 45,
        category: 'Manicures',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        vendorId: vendor._id,
        name: 'Bridal Nail Package',
        description: 'The ultimate bridal nail experience. Includes a custom full set of acrylic or hard gel extensions with intricate nail art, rhinestones, and a complementary hand massage.',
        price: 35000,
        durationInMinutes: 180,
        category: 'Special Packages',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        vendorId: vendor._id,
        name: 'Nail Art (Per Finger)',
        description: 'Add custom designs, chrome powders, or gems to your service. Price is per finger.',
        price: 1000,
        durationInMinutes: 15,
        category: 'Add-ons',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        vendorId: vendor._id,
        name: 'Nail Extension Removal',
        description: 'Safe and gentle removal of acrylic or hard gel extensions to preserve your natural nail health.',
        price: 5000,
        durationInMinutes: 30,
        category: 'Add-ons',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    const result = await db.collection('services').insertMany(newServices);
    console.log(`Successfully added ${result.insertedCount} new services across different categories!`);
    
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

seed();
