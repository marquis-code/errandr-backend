const mongoose = require('mongoose');
require('dotenv').config();
const { Schema } = mongoose;

const ChatMessageSchema = new Schema({}, { strict: false });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const ChatMessage = mongoose.model('ChatMessage', ChatMessageSchema);
  
  const messages = await ChatMessage
    .find()
    .sort({ createdAt: -1 })
    .limit(10);
    
  console.log(messages);
  
  process.exit(0);
}
run();
