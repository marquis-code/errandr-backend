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

  const users = await mongoose.connection.collection('users').find({ fcmToken: { $ne: null, $exists: true, $ne: "" } }).toArray();
  
  if (!users || users.length === 0) {
    console.log('No FCM tokens found for any user');
    process.exit(0);
  }
  
  console.log(`Found ${users.length} users with FCM tokens. Sending push notifications...`);
  
  for (const user of users) {
    console.log(`Sending to ${user.email}...`);
    const payload = {
      notification: {
        title: 'Erranders Sound Test 🔔',
        body: 'Did you hear the sound? Testing PWA Push Notifications!',
      },
      data: {
        type: 'TEST_PUSH',
        orderId: '12345'
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'high_priority_orders',
        },
      },
      apns: {
        headers: {
          'apns-priority': '10',
        },
        payload: {
          aps: {
            sound: 'default',
          },
        },
      },
      webpush: {
        headers: {
          Urgency: 'high',
        },
      },
      token: user.fcmToken
    };
    
    try {
      const res = await admin.messaging().send(payload);
      console.log(`✅ Successfully sent to ${user.email}:`, res);
    } catch (e) {
      console.error(`❌ Error sending to ${user.email} (Token: ${user.fcmToken.substring(0, 15)}...):`, e.errorInfo?.message || e.message);
      // Optional: if (e.code === 'messaging/registration-token-not-registered') {
      //   console.log(`Token for ${user.email} is no longer valid.`);
      // }
    }
  }
  
  process.exit(0);
}
run();
