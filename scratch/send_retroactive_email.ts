import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { EmailService } from '../src/modules/email/email.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const emailService = app.get(EmailService);

  const emails = ['mikatolee67@gmail.com', 'abahmarquis@gmail.com'];
  const amount = 300;
  const reference = 'manual_retroactive_payout_' + Date.now();

  try {
    for (const email of emails) {
      console.log(`Attempting to aggressively send payout email to ${email} for amount ${amount}`);
      await emailService.sendPayoutSuccessful(email, amount, reference);
      console.log(`Successfully sent email to ${email}`);
    }
  } catch (error) {
    console.error('Failed to send email:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
