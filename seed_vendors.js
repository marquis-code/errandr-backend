const mongoose = require('mongoose');

const MONGODB_URI = "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr";

const vendorSchema = new mongoose.Schema({
  owner: mongoose.Schema.Types.ObjectId,
  storeName: String,
  description: String,
  logo: String,
  banner: String,
  category: String,
  isInsideCampus: Boolean,
  isStudentBusiness: Boolean,
  status: String,
  isOnline: Boolean,
  rating: Number,
  preparationTime: Number,
  deliveryFee: Number,
});

const userSchema = new mongoose.Schema({
  email: String,
  firstName: String,
  lastName: String,
});

const Vendor = mongoose.model('Vendor', vendorSchema);
const User = mongoose.model('User', userSchema);

const vendorsData = [
  { name: 'Mavise', isStudent: false, isInside: true, desc: 'Premium campus delicacies and local favorites.' },
  { name: 'Iya Chidera', isStudent: false, isInside: true, desc: 'Authentic home-cooked meals for the soul.' },
  { name: 'Aunty Iyabo', isStudent: false, isInside: true, desc: 'The legendary taste of traditional campus cuisine.' },
  { name: 'Smoothie Daddy', isStudent: true, isInside: true, desc: 'Ice-cold refreshment and tactical nutrient blends.' },
  { name: 'Chikoke', isStudent: false, isInside: true, desc: 'High-speed snacks and student-favorite bites.' },
  { name: 'Tasty Delight', isStudent: true, isInside: true, desc: 'Sweet escapes and artisanal pastries.' },
  { name: 'Iya Warris', isStudent: false, isInside: true, desc: 'Bold flavors and generous campus portions.' },
  { name: 'Just Spices', isStudent: true, isInside: false, desc: 'Global spice fusion delivered to your doorstep.' },
  { name: 'Iya Monisca', isStudent: false, isInside: true, desc: 'Reliable, delicious, and always on time.' },
];

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find or create a default owner
    let owner = await User.findOne({ email: 'admin@errandr.com' });
    if (!owner) {
      owner = await User.create({
        email: 'admin@errandr.com',
        firstName: 'System',
        lastName: 'Admin',
      });
    }

    for (const v of vendorsData) {
      const exists = await Vendor.findOne({ storeName: v.name });
      if (!exists) {
        await Vendor.create({
          owner: owner._id,
          storeName: v.name,
          description: v.desc,
          category: 'restaurant',
          isInsideCampus: v.isInside,
          isStudentBusiness: v.isStudent,
          status: 'approved',
          isOnline: true,
          rating: 4.5 + Math.random() * 0.5,
          preparationTime: 15 + Math.floor(Math.random() * 20),
          deliveryFee: 150 + Math.floor(Math.random() * 100),
          logo: `https://ui-avatars.com/api/?name=${v.name.replace(' ', '+')}&background=065fdb&color=fff`,
          banner: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200'
        });
        console.log(`Created vendor: ${v.name}`);
      } else {
        console.log(`Vendor already exists: ${v.name}`);
      }
    }

    console.log('Seeding completed');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seed();
