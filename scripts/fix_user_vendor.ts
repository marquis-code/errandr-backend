import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../src/modules/users/schemas/user.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userModel = app.get<Model<User>>(getModelToken(User.name));
  
  const user: any = await userModel.findOne({ email: 'blessingidowu1991@gmail.com' });
  if (user) {
    if (!user.vendorId) {
      await userModel.updateOne(
        { _id: user._id },
        { $set: { vendorId: '6a4e4ba65be2071e52785438' } }
      );
      console.log('Fixed vendorId for user');
    } else {
      console.log('User already has vendorId:', user.vendorId);
    }
  } else {
    console.log('User not found.');
  }

  await app.close();
  process.exit(0);
}
bootstrap();
