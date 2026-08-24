import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const userModel = app.get<Model<any>>(getModelToken('User'));
    const walletModel = app.get<Model<any>>(getModelToken('Wallet'));
    const erranderModel = app.get<Model<any>>(getModelToken('Errander'));

    const user = await userModel.findOne({ email: 'onyekachiakpugo@gmail.com' });
    if (user) {
      console.log(`User ID: ${user._id}`);
      console.log(`User.walletBalance: ${user.walletBalance}`);
      
      const wallet = await walletModel.findOne({ user: user._id });
      console.log(`Wallet Balance: ${wallet?.balance}`);
      
      const errander = await erranderModel.findOne({ user: user._id });
      console.log(`Errander Total Earnings: ${errander?.totalEarnings}`);
    }
  } catch (e) {
    console.log(e);
  }
  await app.close();
}
bootstrap();
