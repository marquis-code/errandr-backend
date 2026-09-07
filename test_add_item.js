const axios = require('axios');
const mongoose = require('mongoose');

async function test() {
  try {
    const res = await axios.post('http://localhost:3005/api/v1/market-pool/campaigns/64e8e8f8e8e8e8e8e8e8e8e8/items', {
      name: "Test",
      description: "Test desc",
      category: "Foodstuffs",
      studentQuantity: "1 Unit",
      appPrice: 500,
      wholesaleEstimatedCost: 400,
      imageUrl: "",
      images: [],
      targetQuantity: 10,
      sourceLocation: "Test",
      weightEstimate: "1kg"
    }, {
      // Need a valid token if there is a JwtAuthGuard, wait I'll bypass or use a real token
    });
    console.log(res.data);
  } catch(e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
test();
