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

    const erranders = await erranderModel.find();
    let migratedCount = 0;

    for (const errander of erranders) {
      if (errander.totalEarnings && errander.totalEarnings > 0) {
        if (!errander.user) continue;

        const userId = errander.user.toString();
        let wallet = await walletModel.findOne({ owner: userId });
        
        if (!wallet) {
          wallet = await walletModel.create({ 
            owner: userId, 
            balance: errander.totalEarnings,
            totalEarned: errander.totalEarnings
          });
          migratedCount++;
        } else if (wallet.balance === 0) {
          wallet.balance = errander.totalEarnings;
          wallet.totalEarned = errander.totalEarnings;
          await wallet.save();
          migratedCount++;
        }

        // Sync with User
        await userModel.findByIdAndUpdate(userId, { walletBalance: wallet.balance });
      }
    }
    console.log(`Successfully migrated ${migratedCount} errander wallets.`);
  } catch (e) {
    console.log(e);
  }
  await app.close();
}
bootstrap();
