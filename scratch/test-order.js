const axios = require('axios');

const testOrderDispatch = async (phoneNumber) => {
  try {
    console.log(`🚀 Triggering FULL ORDER DISPATCH test to ${phoneNumber}...`);
    const response = await axios.post('http://127.0.0.1:3005/api/v1/twilio/test-dispatch', {
      to: phoneNumber
    });
    console.log('✅ Response:', response.data);
    console.log('\nGet ready! 📞 You will hear the full order details and be asked to press 1 to accept.');
  } catch (error) {
    console.error('❌ Error triggering call:', error.response?.data || error.message);
  }
};

const number = process.argv[2];
if (!number) {
  console.log('Usage: node test-order.js +234XXXXXXXXXX');
} else {
  testOrderDispatch(number);
}
