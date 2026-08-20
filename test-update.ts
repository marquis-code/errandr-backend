import mongoose from 'mongoose';
import { Schema, model } from 'mongoose';

const schema = new Schema({
  name: String,
  prepaidPromo: {
    type: {
      enabled: { type: Boolean, default: false },
      budgetPerOrder: { type: Number, default: 0 },
      maxOrders: { type: Number, default: 0 },
      discountValue: { type: Number, default: 1000 },
      usedOrders: { type: Number, default: 0 },
      label: { type: String, default: '' },
      description: { type: String, default: '' },
    },
    default: { enabled: false, budgetPerOrder: 0, maxOrders: 0, usedOrders: 0, label: '', description: '' },
  }
});

const Vendor = model('Vendor', schema);

async function run() {
  await mongoose.connect('mongodb://localhost:27017/erranders');
  const v = new Vendor({ name: 'Test' });
  await v.save();
  
  try {
    Object.assign(v, {
      prepaidPromo: {
        enabled: true,
        budgetPerOrder: 500,
        maxOrders: 10,
        discountValue: 700,
        usedOrders: 0,
        label: "Student Combo",
        description: "Special promo combo for students."
      }
    });
    await v.save();
    console.log('Success');
  } catch (e) {
    console.error('Error:', e);
  }
  process.exit(0);
}
run();
