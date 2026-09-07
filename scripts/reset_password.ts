import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const UserModel = app.get<Model<any>>(getModelToken('User'));

  const user = await UserModel.findOne({ email: 'abahmarquis@gmail.com' });
  
  if (user) {
    user.password = await bcrypt.hash('Miles1999@', 10);
    await user.save();
    console.log(`Password reset successfully for ${user.email}. Note: Their role in DB is '${user.role}'`);
  } else {
    console.log("User not found");
  }

  await app.close();
}

bootstrap();
