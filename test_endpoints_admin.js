const axios = require('axios');
async function run() {
  try {
    const t = (await axios.post('http://localhost:3006/api/v1/auth/login', {email: 'erranders@admin.com', password: 'Password123!'})).data.data.token;
    const h = { headers: { Authorization: `Bearer ${t}` } };
    
    const d = (await axios.get('http://localhost:3006/api/v1/admin/dispatchers?limit=1', h)).data.dispatchers?.[0];
    const v = (await axios.get('http://localhost:3006/api/v1/admin/vendors?limit=1', h)).data.vendors?.[0];
    const o = (await axios.get('http://localhost:3006/api/v1/admin/orders/recent?limit=1', h)).data.data?.[0] || (await axios.get('http://localhost:3006/api/v1/admin/orders?limit=1', h)).data.data?.[0];
    const u = (await axios.get('http://localhost:3006/api/v1/admin/users?limit=1', h)).data.data?.[0];

    console.log("== DISPATCHER ==");
    console.log(JSON.stringify(d, null, 2));
    console.log("== VENDOR ==");
    console.log(JSON.stringify(v, null, 2));
    console.log("== ORDER ==");
    console.log(JSON.stringify(o, null, 2));
    console.log("== USER ==");
    console.log(JSON.stringify(u, null, 2));
  } catch(e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
run();
