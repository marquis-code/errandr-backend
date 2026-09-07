import mongoose from 'mongoose';
const id1 = new mongoose.Types.ObjectId();
const obj = {
  order: id1,
  rider: {
    _id: new mongoose.Types.ObjectId(),
    name: 'test'
  }
};
console.log(JSON.stringify(obj));
