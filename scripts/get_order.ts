import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const OrderModel = app.get<Model<any>>(getModelToken('Order'));

  const order = await OrderModel.findOne({ reference: 'ERR-31455F67' });
  console.log(JSON.stringify(order, null, 2));

  await app.close();
}

bootstrap();
