const axios = require('axios');

async function test() {
  try {
    console.log('Sending transaction initialization request for student@erranders.test...');
    const res = await axios.post('http://localhost:3000/api/v1/payments/initialize', {
      amount: 1000,
      email: 'student@erranders.test',
      reference: 'TEST-REF-' + Date.now(),
      callback_url: 'http://localhost:3001/cart',
      metadata: {
        userId: '6a112be35850f86e9f034a63'
      }
    });

    console.log('\nResponse Status:', res.status);
    console.log('Response Data:', JSON.stringify(res.data, null, 2));
    if (res.data && res.data.status) {
      console.log('\n✅ Paystack initialization succeeded!');
    } else {
      console.log('\n❌ Paystack initialization failed!');
    }
  } catch (err) {
    console.error('\n❌ Error:', err.response ? err.response.data : err.message);
  }
}

test();
