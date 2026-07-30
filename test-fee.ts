import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { OrdersService } from './src/modules/orders/orders.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const ordersService = app.get(OrdersService);
  const fee = await ordersService.calculateDynamicFee(
    '6a4e4ba65be2071e52785438',
    '6a4e4ad05be2071e52785395',
    'College of medicine university of lagos idiaraba'
  );
  console.log('FEE:', fee);
  await app.close();
}
bootstrap();
