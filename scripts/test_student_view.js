const axios = require('axios');

async function test() {
  try {
    const vendorId = '6a10589033746a05322633c7';
    console.log(`Calling GET http://localhost:3000/api/v1/products/vendor/${vendorId}...`);
    const res = await axios.get(`http://localhost:3000/api/v1/products/vendor/${vendorId}`);

    console.log('\nResponse Status:', res.status);
    console.log('Is Array?', Array.isArray(res.data));
    if (Array.isArray(res.data)) {
      console.log('Products Count:', res.data.length);
      console.log('Categories present:');
      const categories = [...new Set(res.data.map(p => p.category))];
      console.log(categories);
      console.log('\nSample Product details:');
      console.log({
        name: res.data[0].name,
        price: res.data[0].price,
        category: res.data[0].category,
        isAvailable: res.data[0].isAvailable,
        isPreOrder: res.data[0].isPreOrder
      });
    } else {
      console.log('Unexpected response:', res.data);
    }
  } catch (err) {
    console.error('Error:', err.response ? err.response.data : err.message);
  }
}

test();
