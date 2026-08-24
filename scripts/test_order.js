const axios = require('axios');
const payload = {
    "vendorId": "6a4e4ba65be2071e52785438",
    "packs": [
        {
            "packId": "pack_1787527561984_6",
            "name": "Standard Pack",
            "packType": {
                "name": "Standard Pack",
                "price": 150
            },
            "items": [
                {
                    "product": "6a84186e3b38568ca4824028",
                    "name": "Ewa Agoyin",
                    "price": 100,
                    "image": "https://res.cloudinary.com/dfpabtrke/image/upload/v1787041893/erranders/f7oyldj1rt16eu2cyfwi.jpg",
                    "quantity": 1,
                    "subtotal": 100,
                    "customizations": []
                }
            ]
        }
    ],
    "subtotal": 100,
    "deliveryFee": 350,
    "serviceFee": 50,
    "platformProcessingFee": 0,
    "packagingFee": 150,
    "selectedPack": {
        "name": "Standard Pack",
        "price": 150,
        "isActive": true,
        "_id": "6a4e4ba65be2071e52785441"
    },
    "isMysteryBox": false,
    "isDormDelivery": false,
    "deliveryOption": "use_an_errander",
    "deliveryMode": "dropoff_service",
    "recipientName": "Test Order",
    "recipientPhone": "08147626503",
    "specificAddress": "Mushin Back Gate Pharmacy",
    "deliveryAddress": "Mushin Back Gate Pharmacy",
    "weight": 1,
    "isPreOrder": false,
    "scheduledDate": "",
    "wantsNotification": false,
    "notifyEmail": "",
    "useFreeDeliveryToken": false,
    "vendorNote": "",
    "promoCode": "ADMIN001",
    "locationType": "campus_environs",
    "proposedDeliveryFee": 350
};

axios.post('http://localhost:3005/api/v1/orders', payload, {
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' // wait, I don't have the token.
    },
    timeout: 5000
}).catch(console.error);
