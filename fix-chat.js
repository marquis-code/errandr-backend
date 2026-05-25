const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr');

const chatSchema = new mongoose.Schema({}, { strict: false });
const ChatMessage = mongoose.model('ChatMessage', chatSchema, 'chatmessages');

async function run() {
  const vendorMessages = [
    "Hello Adaobiiiiiii",
    "Can you hear me adaobiiiii\\",
    "ok leme test again",
    "go ral",
    "one mmore man",
    "Huuuu",
    "again",
    "Helllo Again",
    "Heiii"
  ];
  
  const res = await ChatMessage.updateMany(
    { message: { $in: vendorMessages } },
    { $set: { sender: new mongoose.Types.ObjectId('6a10589033746a05322633c7'), receiver: new mongoose.Types.ObjectId('6a112be35850f86e9f034a63') } }
  );
  
  console.log("Updated:", res.modifiedCount);
  process.exit();
}
run();
