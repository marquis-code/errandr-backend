import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const walletModel = app.get<Model<any>>(getModelToken('Wallet'));
    const userModel = app.get<Model<any>>(getModelToken('User'));

    const wallets = await walletModel.find();
    let synced = 0;

    for (const wallet of wallets) {
      if (wallet.balance > 0) {
        await userModel.findByIdAndUpdate(wallet.owner, { walletBalance: wallet.balance });
        synced++;
      }
    }
    console.log(`Successfully synced ${synced} users.`);
  } catch (e) {
    console.log(e);
  }
  await app.close();
}
bootstrap();
