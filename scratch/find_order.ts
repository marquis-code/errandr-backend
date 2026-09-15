import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order } from '../src/modules/orders/schemas/order.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const orderModel = app.get<Model<Order>>(getModelToken(Order.name));

  const order = await orderModel.findOne({ orderNumber: 'ERR-D6397A32' }).populate('errander');
  
  if (order) {
    console.log(`Order ID: ${order._id}, Status: ${order.status}`);
    console.log(`Errander: ${order.errander ? (order.errander as any).firstName : 'None'}`);
  } else {
    console.log('Order not found');
  }

  await app.close();
}
bootstrap();
