const axios = require('axios');
async function run() {
  const res = await axios.get('http://localhost:3006/api/v1/products/all-promos');
  const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
  console.log(JSON.stringify(data.map(p => ({name: p.name, slotsLeft: p.slotsLeft})), null, 2));
}
run();
