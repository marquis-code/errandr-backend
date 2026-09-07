import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { EmailService } from '../src/modules/email/email.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const emailService = app.get(EmailService);

  const mockOrder = {
    _id: '64a7c8b0e4b0',
    orderNumber: 'ORD-TEST123',
    customer: {
      firstName: 'Marquis',
    },
    securityPin: '7392',
    total: 3500,
    items: [
      { name: 'Jollof Rice & Chicken', quantity: 1, price: 2000 },
      { name: 'Plantain', quantity: 2, price: 500 },
      { name: 'Cold Drink', quantity: 1, price: 500 }
    ]
  };

  try {
    await emailService.sendOrderConfirmation('abahmarquis@gmail.com', mockOrder);
    console.log('Successfully sent test order confirmation email to abahmarquis@gmail.com');
  } catch (err) {
    console.error('Failed to send email:', err);
  }

  await app.close();
}

bootstrap();
