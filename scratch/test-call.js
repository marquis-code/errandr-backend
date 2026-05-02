const axios = require('axios');

const testCall = async (phoneNumber) => {
  try {
    console.log(`🚀 Triggering test call to ${phoneNumber}...`);
    const response = await axios.post('http://127.0.0.1:3005/api/v1/twilio/make-call', {
      to: phoneNumber,
      message: "Hello! This is a test call from Errandr. The system is now fully integrated with Twilio. Press 1 to confirm everything is working."
    });
    console.log('✅ Response:', response.data);
    console.log('\nCheck your phone! 📞');
  } catch (error) {
    console.error('❌ Error triggering call:', error.response?.data || error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Tip: Make sure your backend is running on port 3005 (npm run start:dev)');
    }
  }
};

const number = process.argv[2];
if (!number) {
  console.log('Usage: node test-call.js +234XXXXXXXXXX');
} else {
  testCall(number);
}
