const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(async () => {
  const users = await mongoose.connection.collection('users').find({ email: 'oyewolegoodness444@gmail.com' }).toArray();
  console.log("User:", users.map(u => u._id.toString()));
  
  if (users.length > 0) {
    const erranders = await mongoose.connection.collection('erranders').find({ user: users[0]._id }).toArray();
    console.log("Errander:", erranders.map(e => e._id.toString()));
    console.log("Total deliveries on profile:", erranders[0].totalDeliveries);
    
    // check orders by User ID
    const ordersByUser = await mongoose.connection.collection('orders').find({ errander: users[0]._id }).toArray();
    console.log("Orders found by User ID:", ordersByUser.length);

    // check orders by User ID string
    const ordersByUserStr = await mongoose.connection.collection('orders').find({ errander: users[0]._id.toString() }).toArray();
    console.log("Orders found by User ID (string):", ordersByUserStr.length);
    
    // check orders by Errander ID
    const ordersByErr = await mongoose.connection.collection('orders').find({ errander: erranders[0]._id }).toArray();
    console.log("Orders found by Errander ID:", ordersByErr.length);

    // check orders by Errander ID string
    const ordersByErrStr = await mongoose.connection.collection('orders').find({ errander: erranders[0]._id.toString() }).toArray();
    console.log("Orders found by Errander ID (string):", ordersByErrStr.length);
    
    if (ordersByUser.length > 0) {
       console.log("Sample Order Errander Field Type:", typeof ordersByUser[0].errander, ordersByUser[0].errander);
    } else if (ordersByErr.length > 0) {
       console.log("Sample Order Errander Field Type:", typeof ordersByErr[0].errander, ordersByErr[0].errander);
    } else if (ordersByUserStr.length > 0) {
       console.log("Sample Order Errander Field Type:", typeof ordersByUserStr[0].errander, ordersByUserStr[0].errander);
    } else if (ordersByErrStr.length > 0) {
       console.log("Sample Order Errander Field Type:", typeof ordersByErrStr[0].errander, ordersByErrStr[0].errander);
    } else {
       console.log("NO ORDERS FOUND AT ALL in DB for this person.");
       // maybe let's search for an order that has any errander to see what is stored
       const someOrder = await mongoose.connection.collection('orders').findOne({ errander: { $exists: true, $ne: null } });
       if (someOrder) {
          console.log("Some random order errander field:", typeof someOrder.errander, someOrder.errander);
       }
    }
  }
  
  process.exit(0);
});
