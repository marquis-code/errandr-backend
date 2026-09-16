import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../src/modules/users/schemas/user.schema';
import * as bcrypt from 'bcryptjs';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userModel = app.get<Model<User>>(getModelToken(User.name));

  const newPassword = 'password123';
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  
  await userModel.updateOne(
    { email: 'chipsbymotee@vendor.com' },
    { $set: { password: hashedPassword } }
  );

  console.log('Password reset to:', newPassword);

  await app.close();
  process.exit(0);
}
bootstrap();
