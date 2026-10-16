const { NestFactory } = require('@nestjs/core');
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

async function test() {
    await mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr');
    
    // We only need the Order model
    const orderSchema = new Schema({}, { strict: false });
    const OrderModel = mongoose.model('Order', orderSchema, 'orders');
    
    const order = await OrderModel.findById("6ab6be89a70a5db8ce6d6517");
    console.log(order._id);
    
    order.vendorRating = 5;
    order.erranderRating = 5;
    try {
       await order.save();
       console.log("Saved successfully");
    } catch(e) {
       console.error("Save failed:", e);
    }
    process.exit(0);
}
test();
