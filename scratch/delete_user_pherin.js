require('dotenv').config();
const mongoose = require('mongoose');
const admin = require('firebase-admin');

async function deleteUser() {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

    if (projectId && privateKey && clientEmail) {
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            privateKey: privateKey.replace(/\\n/g, '\n'),
            clientEmail,
          }),
        });
        console.log('Firebase Admin initialized successfully');
      }
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const emailToFind = 'pherinchemey369@gmail.com';
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');

    const user = await User.findOne({ email: emailToFind });
    if (!user) {
      console.log(`User with email ${emailToFind} not found in MongoDB.`);
    } else {
      console.log('Found user in MongoDB:', user._id, user.email);
      await User.deleteOne({ _id: user._id });
      console.log('Deleted user from MongoDB.');
      
      // Delete from Firebase using Firebase UID if it exists on the user model, or search by email
      try {
        const firebaseUser = await admin.auth().getUserByEmail(emailToFind);
        if (firebaseUser) {
          await admin.auth().deleteUser(firebaseUser.uid);
          console.log(`Deleted user ${firebaseUser.uid} from Firebase Auth.`);
        }
      } catch (fbError) {
        if (fbError.code === 'auth/user-not-found') {
          console.log('User not found in Firebase Auth.');
        } else {
          console.error('Error deleting from Firebase Auth:', fbError);
        }
      }
    }
    
    // Also try checking Firebase just in case it wasn't in Mongo
    if (!user) {
        try {
            const firebaseUser = await admin.auth().getUserByEmail(emailToFind);
            if (firebaseUser) {
              await admin.auth().deleteUser(firebaseUser.uid);
              console.log(`Deleted user ${firebaseUser.uid} from Firebase Auth (MongoDB doc was missing).`);
            }
          } catch (fbError) {
            if (fbError.code === 'auth/user-not-found') {
              console.log('User not found in Firebase Auth.');
            } else {
              console.error('Error checking Firebase Auth:', fbError);
            }
          }
    }

  } catch (error) {
    console.error('Error during deletion:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
}

deleteUser();
