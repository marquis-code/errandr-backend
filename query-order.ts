import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { OrdersService } from './src/modules/orders/orders.service';
import { getModelToken } from '@nestjs/mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const orderModel = app.get(getModelToken('Order'));
  const order = await orderModel.findOne({ orderNumber: 'ERR-DF5D0345' });
  console.log(JSON.stringify(order, null, 2));
  await app.close();
}
bootstrap();
