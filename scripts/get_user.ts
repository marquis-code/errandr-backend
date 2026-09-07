import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const UserModel = app.get<Model<any>>(getModelToken('User'));

  const user: any = await UserModel.findOne({ email: 'abahmarquis@gmail.com' });
  
  if (user) {
    console.log(JSON.stringify({
      id: user._id,
      email: user.email,
      role: user.role,
      passwordHash: user.password
    }, null, 2));
    
    // reset password to something known for testing
    const bcrypt = require('bcryptjs');
    user.password = await bcrypt.hash('password123', 10);
    await user.save();
    console.log("Password reset to: password123");
  } else {
    console.log("User not found");
  }

  await app.close();
}

bootstrap();
