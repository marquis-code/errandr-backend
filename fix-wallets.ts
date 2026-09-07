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

    // Find wallets whose user ID matches an Errander ID instead of a User ID
    const erranders = await erranderModel.find();
    let found = 0;
    
    for (const errander of erranders) {
      const erranderIdStr = errander._id.toString();
      const orphanWallet = await walletModel.findOne({ user: erranderIdStr });
      if (orphanWallet && orphanWallet.balance > 0) {
        console.log(`Found orphan wallet for errander ${erranderIdStr} with balance ${orphanWallet.balance}`);
        found++;
      }
    }
    console.log(`Total orphan wallets found: ${found}`);

  } catch (e) {
    console.log(e);
  }
  await app.close();
}
bootstrap();
