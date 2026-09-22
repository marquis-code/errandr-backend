const mongoose = require('mongoose');
const payload = {
  storeName: "Test Store",
  baseDeliveryFee: 100,
  owner: {
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    phone: "1234567890"
  },
  businessHours: [
    { day: 'monday', open: '08:00', close: '21:00', isClosed: false }
  ]
};

console.log("Test script ready.");
