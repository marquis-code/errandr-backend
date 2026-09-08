import mongoose from 'mongoose';
mongoose.connect('mongodb://localhost:27017/erranders');
const db = mongoose.connection;
db.once('open', async () => {
  const users = await db.collection('users').find({}).toArray();
  console.log('Users roles:', users.map(u => ({ id: u._id, role: u.role, email: u.email })));
  process.exit(0);
});
