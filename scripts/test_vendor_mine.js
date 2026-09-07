const axios = require('axios');

async function test() {
  try {
    console.log('Logging in as dobiecakes@gmail.com...');
    const loginRes = await axios.post('http://localhost:3000/api/v1/auth/login', {
      email: 'dobiecakes@gmail.com',
      password: 'Test@1234'
    });

    const token = loginRes.data.token;
    console.log('Login Success. Token:', token.substring(0, 15) + '...');

    console.log('Calling GET /api/v1/products/vendor/mine...');
    const productsRes = await axios.get('http://localhost:3000/api/v1/products/vendor/mine', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log('\nResponse Status:', productsRes.status);
    console.log('Response Type:', typeof productsRes.data);
    console.log('Is Array?', Array.isArray(productsRes.data));
    console.log('Sample Data Structure (first 2 items):');
    const data = productsRes.data;
    if (Array.isArray(data)) {
      console.log('Array length:', data.length);
      console.log(JSON.stringify(data.slice(0, 2), null, 2));
    } else {
      console.log(JSON.stringify(data, null, 2));
    }

  } catch (err) {
    console.error('Error during API request:', err.response ? err.response.data : err.message);
  }
}

test();
