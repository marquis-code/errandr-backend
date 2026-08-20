const axios = require('axios');
async function run() {
  const t = (await axios.post('http://localhost:3006/api/v1/auth/login', {email: 'erranders@admin.com', password: 'Password123!'})).data.data.token;
  const h = { headers: { Authorization: `Bearer ${t}` } };
  
  const dis = (await axios.get('http://localhost:3006/api/v1/admin/erranders', h)).data;
  console.log('Dispatchers keys:', Object.keys(dis.data?.[0] || {}));
  
  const v = (await axios.get('http://localhost:3006/api/v1/admin/vendors', h)).data;
  console.log('Vendors keys:', Object.keys(v.data?.[0] || {}));

  process.exit(0);
}
run();
