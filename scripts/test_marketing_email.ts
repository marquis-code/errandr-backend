import * as dotenv from 'dotenv';
dotenv.config();
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EmailService } from '../src/modules/email/email.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const UserModel = app.get<Model<any>>(getModelToken('User'));
  const OrderModel = app.get<Model<any>>(getModelToken('Order'));
  const emailService = app.get(EmailService);

  const email = 'abahmarquis@gmail.com';
  const user: any = await UserModel.findOne({ email });
  
  if (user) {
    const orderCount = await OrderModel.countDocuments({ customer: user._id });
    
    await emailService.sendCuteDailyEmail(
      user.email,
      `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      user.points || 0,
      orderCount
    );
    
    console.log(`Cute marketing email successfully sent to ${email} (Orders: ${orderCount}, Points: ${user.points || 0})`);
  } else {
    console.log(`User not found: ${email}`);
  }

  await app.close();
}

bootstrap();
