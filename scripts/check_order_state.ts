import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const OrderModel = app.get<Model<any>>(getModelToken('Order'));

  const order: any = await OrderModel.findById('6a8b9dd1d139695dfba93ce7')
    .populate('errander')
    .populate('customer')
    .lean();

  if (!order) {
    console.log('Order NOT found');
  } else {
    console.log(JSON.stringify({
      _id: order._id,
      status: order.status,
      deliveryPin: order.deliveryPin,
      errander: order.errander ? { _id: order.errander._id, user: order.errander.user } : null,
      type: order.type,
      customer: order.customer?._id,
    }, null, 2));
  }

  await app.close();
}

bootstrap();
