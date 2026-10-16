const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const orderSchema = new Schema({
    // Add required fields only to test if any is missing
    customer: { type: Schema.Types.ObjectId, required: true },
    type: { type: String, required: true },
    status: { type: String, required: true },
    // I can just read the actual schema file!
});
