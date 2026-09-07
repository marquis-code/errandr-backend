import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const UserModel = app.get<Model<any>>(getModelToken('User'));

  console.log('--- Allowed User for Promo ---');
  const allowedUser = await UserModel.findById('6a26f7ddafbcb547fd7b3c67');
  console.log(allowedUser ? { name: `${allowedUser.firstName} ${allowedUser.lastName}`, email: allowedUser.email, id: allowedUser._id } : 'Not found');

  console.log('\n--- Your Current Test User ---');
  const testUser = await UserModel.findById('6a5fcde64a331e5430a9728f');
  console.log(testUser ? { name: `${testUser.firstName} ${testUser.lastName}`, email: testUser.email, id: testUser._id } : 'Not found');

  await app.close();
}

bootstrap();
