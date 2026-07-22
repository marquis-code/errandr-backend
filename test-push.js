const mongoose = require('mongoose');
const admin = require('firebase-admin');
const dotenv = require('dotenv');
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');
  
  if (process.env.FIREBASE_PROJECT_ID) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  } else {
    admin.initializeApp();
  }

  const user = await mongoose.connection.collection('users').findOne({ fcmToken: { $ne: null, $exists: true } }, { sort: { _id: -1 } });
  
  if (!user || !user.fcmToken) {
    console.log('No FCM token found for any user');
    process.exit(0);
  }
  
  console.log('Sending push to user:', user.email, 'Token:', user.fcmToken);
  
  const payload = {
    notification: {
      title: 'Erranders Test',
      body: 'Testing PWA Push Notifications!',
    },
    data: {
      type: 'TEST_PUSH',
      orderId: '12345'
    },
    token: user.fcmToken
  };
  
  try {
    const res = await admin.messaging().send(payload);
    console.log('Successfully sent message:', res);
  } catch (e) {
    console.error('Error sending message:', e);
  }
  process.exit(0);
}
run();
