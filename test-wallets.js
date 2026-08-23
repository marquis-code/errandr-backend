const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://campuslink6:tqA6aG7rXJ3L6kXb@cluster0.rtm1fse.mongodb.net/erranders', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(async () => {
  const wallets = await mongoose.connection.collection('wallets').find().limit(5).toArray();
  console.log("Wallets:", wallets.map(w => ({ _id: w._id, ownerType: typeof w.owner, owner: w.owner, balance: w.balance })));
  const users = await mongoose.connection.collection('users').find({ _id: wallets[0].owner }).toArray();
  console.log("Users matching owner:", users.map(u => u._id));
  process.exit(0);
});
