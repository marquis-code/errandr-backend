import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../src/modules/users/schemas/user.schema';
import { JwtService } from '@nestjs/jwt';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userModel = app.get<Model<User>>(getModelToken(User.name));
  const jwtService = app.get(JwtService);
  
  const user = await userModel.findOne({ email: 'blessingidowu1991@gmail.com' });
  if (user) {
    const payload = { sub: user._id.toString(), email: user.email, role: user.role };
    const token = jwtService.sign(payload);
    console.log(token);
  } else {
    console.log('User not found.');
  }

  await app.close();
  process.exit(0);
}
bootstrap();
