import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const OrderModel = app.get<Model<any>>(getModelToken('Order'));

  const negotiating = await OrderModel.countDocuments({ status: 'NEGOTIATING' });
  const awaiting = await OrderModel.countDocuments({ status: 'AWAITING_PAYMENT' });
  const pending = await OrderModel.countDocuments({ status: 'PENDING' });
  
  console.log(`NEGOTIATING: ${negotiating}`);
  console.log(`AWAITING_PAYMENT: ${awaiting}`);
  console.log(`PENDING: ${pending}`);

  await app.close();
}
bootstrap();
