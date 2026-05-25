const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr');

const chatSchema = new mongoose.Schema({}, { strict: false });
const ChatMessage = mongoose.model('ChatMessage', chatSchema, 'chatmessages');

async function run() {
  const msgs = await ChatMessage.find().sort({createdAt: -1}).limit(20);
  console.log(JSON.stringify(msgs, null, 2));
  process.exit();
}
run();
