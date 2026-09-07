const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr');
const db = mongoose.connection;
db.once('open', async () => {
  const Chat = mongoose.connection.db.collection('chatmessages');
  const msgs = await Chat.find({ roomType: 'support' }).sort({ createdAt: -1 }).toArray();
  console.log("Support messages count:", msgs.length);
  
  if (msgs.length > 0) {
      console.log("Latest support message:", JSON.stringify(msgs[0], null, 2));
      console.log("Second latest support message:", JSON.stringify(msgs[1], null, 2));
  }
  
  mongoose.disconnect();
});
