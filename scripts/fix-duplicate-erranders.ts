import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order } from '../src/modules/orders/schemas/order.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const erranderModel = app.get<Model<any>>(getModelToken('Errander'));
  const userModel = app.get<Model<any>>(getModelToken('User'));
  const orderModel = app.get<Model<Order>>(getModelToken(Order.name));

  // Find all erranders
  const allErranders = await erranderModel.find().lean();
  console.log(`Total Erranders: ${allErranders.length}`);

  let deletedCount = 0;
  for (const errander of allErranders) {
    // Check if the user reference actually exists in Users collection
    const user = await userModel.findById(errander.user);
    if (!user) {
      console.log(`Orphaned Errander found: _id=${errander._id}, userRef=${errander.user}`);
      
      // Look for orders assigned to this orphaned errander/userRef
      const orders = await orderModel.find({ errander: errander.user });
      for (const order of orders) {
        console.log(`  Fixing order ${order._id} assigned to orphaned errander`);
        
        // Let's find the correct errander ID. We know the userRef here is actually an Errander ID.
        // So errander.user = The real Errander _id.
        // Let's get the real Errander
        const realErrander = await erranderModel.findById(errander.user);
        if (realErrander && realErrander.user) {
           console.log(`  Changing order errander to correct User ID: ${realErrander.user}`);
           await orderModel.findByIdAndUpdate(order._id, { errander: realErrander.user });
        } else {
           console.log(`  Could not find real Errander for ${errander.user}, unassigning order`);
           await orderModel.findByIdAndUpdate(order._id, { $unset: { errander: 1 } });
        }
      }

      await erranderModel.findByIdAndDelete(errander._id);
      deletedCount++;
    }
  }

  console.log(`Deleted ${deletedCount} orphaned errander documents and fixed related orders.`);
  
  await app.close();
}
bootstrap();
