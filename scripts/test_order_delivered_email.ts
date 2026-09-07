import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { EmailService } from '../src/modules/email/email.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const emailService = app.get(EmailService);
  
  const mockOrder = {
    _id: '64f8a3c8e51b2c45e8a71234',
    orderNumber: 'ORD-A91B4C',
    total: 3500,
    items: [
      { name: 'Jollof Rice & Chicken', quantity: 1, price: 2000 },
      { name: 'Plantain', quantity: 2, price: 500 },
      { name: 'Cold Drink', quantity: 1, price: 500 }
    ]
  };

  console.log('Sending order delivered email...');
  await emailService.sendOrderDelivered('abahmarquis@gmail.com', mockOrder);
  console.log('Done!');
  
  await app.close();
  process.exit(0);
}

bootstrap().catch(console.error);
