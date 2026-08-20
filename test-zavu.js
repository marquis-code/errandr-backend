require('dotenv').config();
const Zavudev = require('@zavudev/sdk').default;

const apiKey = process.env.ZAVU_API_KEY;
const senderId = process.env.ZAVU_SENDER_ID;

if (!apiKey || !senderId) {
  console.error("Missing ZAVU_API_KEY or ZAVU_SENDER_ID in environment.");
  process.exit(1);
}

const zavu = new Zavudev({ apiKey });
const phone = '+2348147626503';
const text = 'Hello from Erranders! This is a test message via Zavu SDK.';

async function sendTest() {
  try {
    console.log("Sending SMS to", phone);
    const smsResponse = await zavu.messages.send({
      to: phone,
      text,
      senderId,
      channel: 'sms_oneway'
    });
    console.log("SMS Response:", smsResponse);

    console.log("Sending WhatsApp to", phone);
    const waResponse = await zavu.messages.send({
      to: phone,
      text,
      senderId,
      channel: 'whatsapp'
    });
    console.log("WhatsApp Response:", waResponse);
  } catch (error) {
    console.error("Error sending test message:", error);
  }
}

sendTest();
