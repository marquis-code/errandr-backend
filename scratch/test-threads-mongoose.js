const mongoose = require('mongoose');
require('dotenv').config();
const { Schema } = mongoose;

const ChatMessageSchema = new Schema({
  order: { type: Schema.Types.ObjectId, ref: 'Order' },
  appointment: { type: Schema.Types.ObjectId, ref: 'Appointment' },
  sender: { type: Schema.Types.ObjectId, ref: 'User' },
  receiver: { type: Schema.Types.ObjectId, ref: 'User' },
  message: { type: String, required: true },
  messageType: { type: String, enum: ['text', 'image', 'system', 'voice'], default: 'text' },
  roomType: { type: String, enum: ['order', 'direct', 'support'], required: true },
  attachment: { type: String },
  isRead: { type: Boolean, default: false },
}, { timestamps: true });

const UserSchema = new Schema({
  firstName: String,
  lastName: String,
  email: String,
  role: String,
});

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const User = mongoose.model('User', UserSchema);
  const ChatMessage = mongoose.model('ChatMessage', ChatMessageSchema);
  
  const messages = await ChatMessage
    .find({ roomType: 'support' })
    .populate('sender', 'firstName lastName avatar email role')
    .populate('receiver', 'firstName lastName avatar email role')
    .sort({ createdAt: -1 });
    
  console.log(JSON.stringify(messages, null, 2));
  
  const threads = new Map();
  for (const msg of messages) {
    const sender = msg.sender || {};
    const receiver = msg.receiver || {};

    let studentUser = null;
    if (sender.role === 'student' || sender.role === 'customer' || !['admin', 'bot', undefined].includes(sender.role)) {
       studentUser = sender;
    } else if (receiver.role === 'student' || receiver.role === 'customer' || !['admin', 'bot', undefined].includes(receiver.role)) {
       studentUser = receiver;
    }

    if (!studentUser) {
       if (sender._id && sender._id.toString() !== 'SYSTEM_BOT' && sender.role !== 'admin') {
          studentUser = sender;
       } else if (receiver._id && receiver._id.toString() !== 'SYSTEM_BOT' && receiver.role !== 'admin') {
          studentUser = receiver;
       } else {
           studentUser = sender; 
       }
    }
    
    const userIdStr = studentUser?._id?.toString();
    console.log("userIdStr for msg", msg.message, "is", userIdStr);
    if (!userIdStr || userIdStr === 'SYSTEM_BOT') continue;

    if (!threads.has(userIdStr)) {
      threads.set(userIdStr, {
        userId: userIdStr,
        userData: studentUser,
        lastMessage: msg.message,
        lastMessageAt: msg.createdAt,
        unreadCount: 0, 
      });
    }
    
    if (!msg.isRead && receiver.role === 'admin') {
        threads.get(userIdStr).unreadCount += 1;
    }
  }

  console.log(Array.from(threads.values()));
  
  process.exit(0);
}
run();
