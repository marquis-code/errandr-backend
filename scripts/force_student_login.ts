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
    // FORCE ROLE TO STUDENT so the frontend student payload works
    user.role = 'student';
    await user.save();
    console.log(`Password reset and role forced to student for ${user.email}.`);
  } else {
    console.log("User not found");
  }

  await app.close();
}

bootstrap();
