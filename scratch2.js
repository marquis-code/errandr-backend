const axios = require('axios');
(async () => {
  try {
    const res = await axios.post('http://localhost:3005/api/v1/auth/login', {
      email: 'abahmarquis@gmail.com',
      password: 'password123'
    });
    const token = res.data.token;
    
    // Attempt to create a dummy order
    const orderPayload = {
      "vendorId": "6aa188008a862ac97e18d2c5",
      "packs": [
        {
          "packId": "pack-1",
          "name": "Standard",
          "packType": "standard",
          "items": [
            {
              "product": "6aa188008a862ac97e18d2c7",
              "name": "Test Item",
              "price": 1000,
              "image": "",
              "quantity": 1,
              "subtotal": 1000,
              "customizations": []
            }
          ]
        }
      ],
      "subtotal": 1000,
      "deliveryFee": 150,
      "serviceFee": 150,
      "platformProcessingFee": 0,
      "packagingFee": 0,
      "selectedPack": {
        "name": "Standard",
        "price": 0
      },
      "weight": 1,
      "isMysteryBox": false,
      "isDormDelivery": false,
      "total": 1300,
      "deliveryOption": "use_an_errander",
      "deliveryMode": "room_delivery",
      "recipientName": "abah marquis",
      "recipientPhone": "08147626503",
      "specificAddress": "Test Location",
      "deliveryAddress": "Test Location",
      "isWithinLuth": true,
      "locationType": "inside_campus"
    };

    const orderRes = await axios.post('http://localhost:3005/api/v1/orders', orderPayload, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log("Order created:", orderRes.data);
  } catch (err) {
    console.error("Error creating order:", err.response ? err.response.data : err.message);
  }
})();
