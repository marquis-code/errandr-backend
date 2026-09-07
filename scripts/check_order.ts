import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order } from '../src/modules/orders/schemas/order.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const orderModel = app.get<Model<Order>>(getModelToken(Order.name));
  
  const order = await orderModel.findOne({ type: 'custom_errand' }).sort({ createdAt: -1 });
  console.log(JSON.stringify(order?.customDetails, null, 2));
  
  await app.close();
}
bootstrap();
