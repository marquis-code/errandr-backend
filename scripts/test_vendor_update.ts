import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { VendorsService } from '../src/modules/vendors/vendors.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(VendorsService);
  
  try {
    await service.update('6a89dd8efafcc95c3a312edf', {
      openingTime: "19:00",
      closingTime: "23:00",
      preparationTime: 15,
      packagingFee: 150
    }, 'dummy-owner');
  } catch (e: any) {
    console.error(e.message, e.stack);
  }
  
  await app.close();
}

bootstrap();
