const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { EmailService } = require('./dist/modules/email/email.service');

async function bootstrap() {
  console.log('Initializing Erranders application context...');
  const app = await NestFactory.createApplicationContext(AppModule);
  
  try {
    const emailService = app.get(EmailService);
    const testEmail = 'abahmarquis@gmail.com'; // Your email

    console.log(`Sending Welcome Email to ${testEmail}...`);
    // This will trigger both the email and the new companion push notification
    await emailService.sendWelcomeEmail(testEmail, 'Marquis');
    
    // Give it a second to allow the fire-and-forget push notification to process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('Test completed successfully!');
  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    await app.close();
    process.exit(0);
  }
}

bootstrap();
