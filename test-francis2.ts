import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const erranderModel = app.get<Model<any>>(getModelToken('Errander'));
    const walletModel = app.get<Model<any>>(getModelToken('Wallet'));
    const userModel = app.get<Model<any>>(getModelToken('User'));

    const user = await userModel.findOne({ email: 'onyekachiakpugo@gmail.com' });
    const errander = await erranderModel.findOne({ user: user._id });
    
    console.log('Errander:', errander);
    console.log('Total Earnings:', errander.totalEarnings);
    
    const userId = user._id.toString();
    const wallet = await walletModel.findOne({ owner: userId });
    console.log('Wallet:', wallet);

    if (wallet && wallet.balance === 0 && errander.totalEarnings > 0) {
      wallet.balance = errander.totalEarnings;
      wallet.totalEarned = errander.totalEarnings;
      await wallet.save();
      await userModel.findByIdAndUpdate(userId, { walletBalance: errander.totalEarnings });
      console.log('Manually fixed Francisvix wallet');
    }
  } catch (e) {
    console.log(e);
  }
  await app.close();
}
bootstrap();
