const axios = require('axios');
async function run() {
  try {
    const res = await axios.post('http://localhost:3005/api/v1/auth/login', {
      email: 'danielomolaja83@gmail.com',
      password: 'password123' // assuming default or we can just fetch from DB and create a token...
    });
    console.log(res.data);
  } catch (e) {
    console.error(e.response?.data || e.message);
  }
}
run();
