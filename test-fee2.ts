import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { OrdersService } from './src/modules/orders/orders.service';
import { getModelToken } from '@nestjs/mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const ordersService = app.get(OrdersService);
  const fee = await ordersService.calculateDynamicFee(
    '6a4e4ba65be2071e52785438',
    '6a4e4ad05be2071e52785395',
    'College Of Medicine Road, Lagos 10, Lagos, Nigeria'
  );
  console.log('FEE2:', fee);
  await app.close();
}
bootstrap();
