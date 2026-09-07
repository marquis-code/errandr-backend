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
        name: 'Ombre Full Set',
        description: 'Beautiful two-tone acrylic ombre design seamlessly blended for a flawless finish.',
        price: 18000,
        durationInMinutes: 120,
        category: 'Acrylics & Extensions',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        vendorId: vendor._id,
        name: 'French Tip Acrylics',
        description: 'Classic crisp French tips with a pink or nude base using acrylic powder.',
        price: 16000,
        durationInMinutes: 105,
        category: 'Acrylics & Extensions',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        vendorId: vendor._id,
        name: 'BIAB (Builder in a Bottle) Overlay',
        description: 'A strengthening gel overlay applied to your natural nails to help them grow long and strong.',
        price: 12000,
        durationInMinutes: 60,
        category: 'Manicures',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        vendorId: vendor._id,
        name: 'Express Pedicure',
        description: 'In a rush? Quick soak, nail shaping, cuticle push back, and regular polish.',
        price: 7000,
        durationInMinutes: 30,
        category: 'Pedicures',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        vendorId: vendor._id,
        name: 'Jelly Spa Pedicure',
        description: 'A fun and therapeutic pedicure where water turns into a soft, translucent, gelatinous jelly. Ultimate relaxation.',
        price: 22000,
        durationInMinutes: 75,
        category: 'Pedicures',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        vendorId: vendor._id,
        name: 'Gel Polish Change (Hands)',
        description: 'Removal of old gel polish and fresh application of a new gel color.',
        price: 5000,
        durationInMinutes: 30,
        category: 'Polish & Color',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        vendorId: vendor._id,
        name: 'Chrome Finish',
        description: 'Trendy metallic chrome powder finish applied over any gel color.',
        price: 3000,
        durationInMinutes: 15,
        category: 'Add-ons',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        vendorId: vendor._id,
        name: 'Paraffin Wax Treatment',
        description: 'Warm paraffin wax treatment to soften hands and alleviate joint stiffness.',
        price: 4500,
        durationInMinutes: 20,
        category: 'Spa Treatments',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        vendorId: vendor._id,
        name: '3D Nail Art (Per Finger)',
        description: 'Intricate 3D flowers, bows, or sculpted charms.',
        price: 2000,
        durationInMinutes: 15,
        category: 'Nail Art',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        vendorId: vendor._id,
        name: 'Hand Painted Character Art',
        description: 'Detailed, hand-painted character or complex geometric designs on a single nail.',
        price: 3500,
        durationInMinutes: 25,
        category: 'Nail Art',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    const result = await db.collection('services').insertMany(newServices);
    console.log(`Successfully added ${result.insertedCount} MORE new services!`);
    
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

seed();
