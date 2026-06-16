import mongoose from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr';

async function seed() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.');

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection failed');
  }

  const usersCollection = db.collection('users');
  const vendorsCollection = db.collection('vendors');

  const usersData = [
    {
      email: 'campuslink6@gmail.com',
      firstName: 'Campus',
      lastName: 'Link',
      phone: '08012345678',
      role: 'vendor',
      isActive: true,
      isVerified: true,
      walletBalance: 0,
      vendorProfile: {
        storeName: 'Campus Quick Bites',
        subdomain: 'campus-bites',
        description: 'Hot and fresh meals delivered straight to your hostel.',
        category: 'restaurant',
        businessType: 'physical_product',
        phone: '08012345678',
        address: 'Block C, Moremi Hall',
        isInsideCampus: true,
        isStudentBusiness: true,
        matricNumber: '180404022',
        university: 'University of Lagos',
        preparationTime: 15,
        preOrderOnly: false,
        deliveryFee: 200,
        baseDeliveryFee: 200,
        packagingFee: 100,
        minimumOrder: 1000,
        isOnline: true,
        status: 'approved',
        rating: 5,
        reviewsCount: 0,
        totalSales: 0,
        completedOrders: 0,
        businessHours: [
          { day: 'monday', open: '18:00', close: '23:00', isClosed: false },
          { day: 'tuesday', open: '18:00', close: '23:00', isClosed: false },
          { day: 'wednesday', open: '18:00', close: '23:00', isClosed: false },
          { day: 'thursday', open: '18:00', close: '23:00', isClosed: false },
          { day: 'friday', open: '18:00', close: '00:00', isClosed: false },
          { day: 'saturday', open: '10:00', close: '00:00', isClosed: false },
          { day: 'sunday', open: '12:00', close: '22:00', isClosed: false }
        ]
      }
    },
    {
      email: 'abahkauzy3@gmail.com',
      firstName: 'Sarah',
      lastName: 'Abah',
      phone: '09087654321',
      role: 'vendor',
      isActive: true,
      isVerified: true,
      walletBalance: 0,
      vendorProfile: {
        storeName: 'Sweet Treats by Sarah',
        subdomain: 'sarahs-treats',
        description: 'Custom cakes, cupcakes, and pastries for birthdays and events. Pre-order required!',
        category: 'bakery',
        businessType: 'physical_product',
        phone: '09087654321',
        address: 'Off-campus, Akoka',
        isInsideCampus: false,
        isStudentBusiness: true,
        matricNumber: '190302011',
        university: 'University of Lagos',
        preOrderOnly: true,
        preOrderLeadTime: 48,
        preOrderDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
        deliveryFee: 1000,
        baseDeliveryFee: 1000,
        packagingFee: 500,
        minimumOrder: 5000,
        isOnline: true,
        status: 'approved',
        rating: 5,
        reviewsCount: 0,
        totalSales: 0,
        completedOrders: 0,
        businessHours: [
          { day: 'monday', open: '09:00', close: '17:00', isClosed: false },
          { day: 'tuesday', open: '09:00', close: '17:00', isClosed: false },
          { day: 'wednesday', open: '09:00', close: '17:00', isClosed: false },
          { day: 'thursday', open: '09:00', close: '17:00', isClosed: false },
          { day: 'friday', open: '09:00', close: '17:00', isClosed: false },
          { day: 'saturday', open: '10:00', close: '15:00', isClosed: false },
          { day: 'sunday', open: '00:00', close: '00:00', isClosed: true }
        ]
      }
    },
    {
      email: 'markeyz.code@gmail.com',
      firstName: 'Tobi',
      lastName: 'Markeyz',
      phone: '07011223344',
      role: 'vendor',
      isActive: true,
      isVerified: true,
      walletBalance: 0,
      vendorProfile: {
        storeName: 'Glam by Tobi',
        subdomain: 'glam-by-tobi',
        description: 'Professional makeup artist and hairstylist. I can come to your hostel.',
        category: 'beauty_salon',
        businessType: 'service_provider',
        serviceLocation: 'mobile_operator',
        phone: '07011223344',
        address: 'Honours Hall, Unilag',
        isInsideCampus: true,
        isStudentBusiness: true,
        matricNumber: '200101055',
        university: 'University of Lagos',
        preOrderOnly: true,
        preOrderLeadTime: 24,
        isOnline: true,
        status: 'approved',
        rating: 5,
        reviewsCount: 0,
        totalSales: 0,
        completedOrders: 0,
        businessHours: [
          { day: 'monday', open: '10:00', close: '18:00', isClosed: false },
          { day: 'tuesday', open: '10:00', close: '18:00', isClosed: false },
          { day: 'wednesday', open: '10:00', close: '18:00', isClosed: false },
          { day: 'thursday', open: '10:00', close: '18:00', isClosed: false },
          { day: 'friday', open: '10:00', close: '20:00', isClosed: false },
          { day: 'saturday', open: '08:00', close: '20:00', isClosed: false },
          { day: 'sunday', open: '12:00', close: '18:00', isClosed: false }
        ]
      }
    }
  ];

  const salt = await bcrypt.genSalt();
  const hashedPassword = await bcrypt.hash('password123', salt);

  for (const user of usersData) {
    const existingUser = await usersCollection.findOne({ email: user.email });
    let userId;
    if (existingUser) {
      console.log('User ' + user.email + ' already exists.');
      userId = existingUser._id;
    } else {
      console.log('Creating user ' + user.email + '...');
      const result = await usersCollection.insertOne({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
        password: hashedPassword,
        isActive: user.isActive,
        isVerified: user.isVerified,
        walletBalance: user.walletBalance,
        points: 0,
        referralCount: 0,
        streakCount: 0,
        totalOrders: 0,
        totalDeliveries: 0,
        isPro: false,
        isGuest: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      userId = result.insertedId;
    }

    const existingVendor = await vendorsCollection.findOne({ owner: userId });
    if (existingVendor) {
      console.log('Vendor for ' + user.email + ' already exists.');
    } else {
      console.log('Creating vendor profile for ' + user.email + '...');
      await vendorsCollection.insertOne({
        owner: userId,
        ...user.vendorProfile,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }

  console.log('Seeding complete!');
  await mongoose.disconnect();
}

seed().catch(console.error);
