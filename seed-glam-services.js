/**
 * Seed script for "Glam by Sarah" – beauty salon services & promotional offers
 * Vendor ID: 6a3034fe208ad86f33229126
 */
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

const MONGODB_URI = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr";
const VENDOR_ID = new ObjectId("6a3034fe208ad86f33229126");

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  const db = mongoose.connection.db;

  // ──────────────────────────────────────────────────
  // 1. SEED SERVICES
  // ──────────────────────────────────────────────────
  const servicesCol = db.collection('services');

  // Remove existing services for this vendor first (idempotent)
  await servicesCol.deleteMany({ vendor: VENDOR_ID });
  console.log('🗑️  Cleared old services for Glam by Sarah');

  const now = new Date();
  const services = [
    // ── MAKEUP ──
    {
      vendor: VENDOR_ID,
      name: 'Natural Glow Makeup',
      description: 'Subtle everyday makeup look with foundation, concealer, light eye makeup and nude lips. Perfect for lectures, dates, or casual outings.',
      price: 3500,
      category: 'Makeup',
      durationInMinutes: 30,
      paddingTimeInMinutes: 10,
      isAvailable: true,
      totalBookings: 0,
      rating: 0,
      variants: [],
      extras: [
        { name: 'Add Setting Spray', price: 500, durationInMinutes: 0 },
        { name: 'Add Contour', price: 800, durationInMinutes: 5 },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      vendor: VENDOR_ID,
      name: 'Full Glam Makeup',
      description: 'Full beat with HD foundation, contour, highlight, smokey eyes, lashes and bold lips. Ideal for parties, weddings, and special occasions.',
      price: 8000,
      category: 'Makeup',
      durationInMinutes: 60,
      paddingTimeInMinutes: 15,
      isAvailable: true,
      totalBookings: 0,
      rating: 0,
      variants: [
        { name: 'Soft Glam', price: 8000, durationInMinutes: 60 },
        { name: 'Bridal Glam', price: 15000, durationInMinutes: 90 },
        { name: 'Editorial/Creative', price: 12000, durationInMinutes: 75 },
      ],
      extras: [
        { name: 'Lash Customization', price: 1500, durationInMinutes: 10 },
        { name: 'Gele Tying', price: 3000, durationInMinutes: 20 },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      vendor: VENDOR_ID,
      name: 'Touch-Up / Retouch Makeup',
      description: 'Quick makeup refresh for faded looks. Fix shine, re-apply lips, touch up brows.',
      price: 2000,
      category: 'Makeup',
      durationInMinutes: 15,
      paddingTimeInMinutes: 5,
      isAvailable: true,
      totalBookings: 0,
      rating: 0,
      variants: [],
      extras: [],
      createdAt: now,
      updatedAt: now,
    },

    // ── LASHES ──
    {
      vendor: VENDOR_ID,
      name: 'Classic Lash Extensions',
      description: 'Individual lash extensions for a natural, fuller look. Lightweight and comfortable for daily wear.',
      price: 4000,
      category: 'Lashes',
      durationInMinutes: 45,
      paddingTimeInMinutes: 10,
      isAvailable: true,
      totalBookings: 0,
      rating: 0,
      variants: [
        { name: 'Natural Set', price: 4000, durationInMinutes: 45 },
        { name: 'Full Set', price: 6000, durationInMinutes: 60 },
        { name: 'Mega Volume', price: 8500, durationInMinutes: 75 },
      ],
      extras: [
        { name: 'Colored Lashes', price: 1000, durationInMinutes: 5 },
        { name: 'Lash Tint', price: 800, durationInMinutes: 10 },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      vendor: VENDOR_ID,
      name: 'Lash Removal',
      description: 'Safe professional removal of old lash extensions without damaging natural lashes.',
      price: 1500,
      category: 'Lashes',
      durationInMinutes: 20,
      paddingTimeInMinutes: 5,
      isAvailable: true,
      totalBookings: 0,
      rating: 0,
      variants: [],
      extras: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      vendor: VENDOR_ID,
      name: 'Lash Refill',
      description: 'Refill for existing lash extensions. Keeps your set fresh and full.',
      price: 2500,
      category: 'Lashes',
      durationInMinutes: 30,
      paddingTimeInMinutes: 10,
      isAvailable: true,
      totalBookings: 0,
      rating: 0,
      variants: [],
      extras: [],
      createdAt: now,
      updatedAt: now,
    },

    // ── BROWS ──
    {
      vendor: VENDOR_ID,
      name: 'Brow Shaping & Tinting',
      description: 'Professional brow threading/waxing and tinting to define your arches.',
      price: 2000,
      category: 'Brows',
      durationInMinutes: 20,
      paddingTimeInMinutes: 5,
      isAvailable: true,
      totalBookings: 0,
      rating: 0,
      variants: [
        { name: 'Threading Only', price: 1000, durationInMinutes: 10 },
        { name: 'Waxing + Tint', price: 2000, durationInMinutes: 20 },
        { name: 'Henna Brows', price: 3500, durationInMinutes: 30 },
      ],
      extras: [],
      createdAt: now,
      updatedAt: now,
    },

    // ── HAIR STYLING ──
    {
      vendor: VENDOR_ID,
      name: 'Silk Press / Blow Dry',
      description: 'Heat straightening for natural hair. Silky, bouncy finish with heat protectant.',
      price: 5000,
      category: 'Hair',
      durationInMinutes: 60,
      paddingTimeInMinutes: 10,
      isAvailable: true,
      totalBookings: 0,
      rating: 0,
      variants: [
        { name: 'Short Hair', price: 5000, durationInMinutes: 45 },
        { name: 'Medium Hair', price: 6500, durationInMinutes: 60 },
        { name: 'Long Hair', price: 8000, durationInMinutes: 75 },
      ],
      extras: [
        { name: 'Deep Conditioning', price: 2000, durationInMinutes: 15 },
        { name: 'Trim', price: 1000, durationInMinutes: 10 },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      vendor: VENDOR_ID,
      name: 'Wig Installation',
      description: 'Flawless wig install with lace melting, baby hairs, and styling. Bring your wig or purchase from us.',
      price: 5000,
      category: 'Hair',
      durationInMinutes: 45,
      paddingTimeInMinutes: 10,
      isAvailable: true,
      totalBookings: 0,
      rating: 0,
      variants: [
        { name: 'Basic Install', price: 5000, durationInMinutes: 45 },
        { name: 'Frontal/Closure Install', price: 7000, durationInMinutes: 60 },
        { name: 'Full Lace Install', price: 10000, durationInMinutes: 75 },
      ],
      extras: [
        { name: 'Custom Coloring', price: 3000, durationInMinutes: 30 },
        { name: 'Wig Cap Braid Down', price: 1500, durationInMinutes: 15 },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      vendor: VENDOR_ID,
      name: 'Braiding / Cornrows',
      description: 'Neat cornrow styles, all-back, tribal braids, and creative patterns.',
      price: 3000,
      category: 'Hair',
      durationInMinutes: 60,
      paddingTimeInMinutes: 10,
      isAvailable: true,
      totalBookings: 0,
      rating: 0,
      variants: [
        { name: 'Simple All-Back', price: 3000, durationInMinutes: 45 },
        { name: 'Tribal / Stitch', price: 5000, durationInMinutes: 75 },
        { name: 'Feed-In Braids', price: 7000, durationInMinutes: 90 },
      ],
      extras: [
        { name: 'Add Extensions', price: 2000, durationInMinutes: 15 },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      vendor: VENDOR_ID,
      name: 'Quick Ponytail / Bun',
      description: 'Sleek ponytail or bun styling. Great for a polished look in minutes.',
      price: 2000,
      category: 'Hair',
      durationInMinutes: 20,
      paddingTimeInMinutes: 5,
      isAvailable: true,
      totalBookings: 0,
      rating: 0,
      variants: [],
      extras: [
        { name: 'Add Extensions', price: 1500, durationInMinutes: 10 },
      ],
      createdAt: now,
      updatedAt: now,
    },

    // ── SKINCARE ──
    {
      vendor: VENDOR_ID,
      name: 'Express Facial',
      description: 'Quick cleansing facial with steam, exfoliation, and moisturizer. Great skin reset between classes.',
      price: 3000,
      category: 'Skincare',
      durationInMinutes: 30,
      paddingTimeInMinutes: 5,
      isAvailable: true,
      totalBookings: 0,
      rating: 0,
      variants: [],
      extras: [
        { name: 'Add Face Mask', price: 500, durationInMinutes: 10 },
        { name: 'LED Light Therapy', price: 1500, durationInMinutes: 10 },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      vendor: VENDOR_ID,
      name: 'Deep Cleansing Facial',
      description: 'Full facial treatment with deep cleansing, extraction, serum application, and hydrating mask.',
      price: 6000,
      category: 'Skincare',
      durationInMinutes: 60,
      paddingTimeInMinutes: 10,
      isAvailable: true,
      totalBookings: 0,
      rating: 0,
      variants: [],
      extras: [
        { name: 'Vitamin C Boost', price: 1000, durationInMinutes: 5 },
      ],
      createdAt: now,
      updatedAt: now,
    },

    // ── NAILS ──
    {
      vendor: VENDOR_ID,
      name: 'Gel Manicure',
      description: 'Long-lasting gel polish manicure with cuticle care and nail shaping.',
      price: 3500,
      category: 'Nails',
      durationInMinutes: 45,
      paddingTimeInMinutes: 10,
      isAvailable: true,
      totalBookings: 0,
      rating: 0,
      variants: [
        { name: 'Plain Color', price: 3500, durationInMinutes: 45 },
        { name: 'French Tips', price: 4500, durationInMinutes: 50 },
        { name: 'Nail Art (Simple)', price: 5500, durationInMinutes: 60 },
      ],
      extras: [
        { name: 'Nail Repair', price: 500, durationInMinutes: 5 },
        { name: 'Cuticle Oil Treatment', price: 300, durationInMinutes: 5 },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      vendor: VENDOR_ID,
      name: 'Pedicure',
      description: 'Relaxing pedicure with soak, exfoliation, nail shaping, and polish.',
      price: 3000,
      category: 'Nails',
      durationInMinutes: 45,
      paddingTimeInMinutes: 10,
      isAvailable: true,
      totalBookings: 0,
      rating: 0,
      variants: [
        { name: 'Classic Pedicure', price: 3000, durationInMinutes: 45 },
        { name: 'Spa Pedicure', price: 5000, durationInMinutes: 60 },
      ],
      extras: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      vendor: VENDOR_ID,
      name: 'Press-On Nails Application',
      description: 'Application of custom press-on nails. Fast and affordable nail glam.',
      price: 2000,
      category: 'Nails',
      durationInMinutes: 20,
      paddingTimeInMinutes: 5,
      isAvailable: true,
      totalBookings: 0,
      rating: 0,
      variants: [],
      extras: [
        { name: 'Custom Sizing', price: 500, durationInMinutes: 5 },
      ],
      createdAt: now,
      updatedAt: now,
    },

    // ── PACKAGES ──
    {
      vendor: VENDOR_ID,
      name: 'Student Glow-Up Package',
      description: 'Budget-friendly combo: Natural Glow Makeup + Brow Shaping + Express Facial. The perfect hostel self-care day.',
      price: 7000,
      discountPrice: 8500,
      category: 'Packages',
      durationInMinutes: 75,
      paddingTimeInMinutes: 10,
      isAvailable: true,
      totalBookings: 0,
      rating: 0,
      variants: [],
      extras: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      vendor: VENDOR_ID,
      name: 'Date Night Package',
      description: 'Full Glam Makeup + Classic Lash Extensions + Gel Manicure. Walk in, walk out stunning.',
      price: 14000,
      discountPrice: 16000,
      category: 'Packages',
      durationInMinutes: 120,
      paddingTimeInMinutes: 15,
      isAvailable: true,
      totalBookings: 0,
      rating: 0,
      variants: [],
      extras: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      vendor: VENDOR_ID,
      name: 'Bridal Party Package (per person)',
      description: 'Full Glam Makeup + Mega Lashes + Wig Install + Gel Nails. For the bride and her squad.',
      price: 25000,
      discountPrice: 32000,
      category: 'Packages',
      durationInMinutes: 180,
      paddingTimeInMinutes: 20,
      isAvailable: true,
      totalBookings: 0,
      rating: 0,
      variants: [],
      extras: [],
      createdAt: now,
      updatedAt: now,
    },
  ];

  const insertedServices = await servicesCol.insertMany(services);
  console.log(`✅ Seeded ${insertedServices.insertedCount} services for Glam by Sarah`);

  // ──────────────────────────────────────────────────
  // 2. SEED PROMOTIONAL OFFERS (on the vendor document)
  // ──────────────────────────────────────────────────
  const vendorsCol = db.collection('vendors');

  const offers = [
    '🎓 Students get 15% off all Makeup services – show your ID!',
    '💅 First-time clients: Free Brow Shaping with any Lash service',
    '📦 Book the Student Glow-Up Package and save ₦1,500',
    '👯‍♀️ Bring a friend – both get 10% off any Hair service',
    '🔥 Weekend Flash Deal: Gel Manicure + Pedicure for ₦5,500 (save ₦1,000)',
  ];

  const banners = [
    {
      image: '',
      title: '🎓 Student Discount – 15% Off Makeup',
      description: 'Show your student ID and get 15% off any Makeup service. Valid Mon-Fri.',
      link: '',
      isActive: true,
      startAt: now,
      endAt: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000), // 90 days
      products: [],
    },
    {
      image: '',
      title: '👯‍♀️ Bring a Friend, Both Save 10%',
      description: 'Book together and both enjoy 10% off any Hair service. Tag your bestie!',
      link: '',
      isActive: true,
      startAt: now,
      endAt: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000), // 60 days
      products: [],
    },
  ];

  await vendorsCol.updateOne(
    { _id: VENDOR_ID },
    {
      $set: {
        offers: offers,
        banners: banners,
        isFeatured: true,
      },
    }
  );
  console.log(`✅ Seeded ${offers.length} promotional offers and ${banners.length} banners for Glam by Sarah`);

  await mongoose.disconnect();
  console.log('🎉 Seed complete! Disconnected from MongoDB.');
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
