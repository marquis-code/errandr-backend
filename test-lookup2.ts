import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userModel = app.get<Model<any>>(getModelToken('User'));
  
  const res = await userModel.aggregate([
    { $match: { email: 'abidemirofiat10@gmail.com' } },
    {
      $lookup: {
        from: 'wallets',
        localField: '_id',
        foreignField: 'owner',
        as: 'walletInfo'
      }
    },
    {
      $addFields: {
        walletBalance: { 
          $ifNull: [ { $arrayElemAt: ['$walletInfo.balance', 0] }, 0 ] 
        }
      }
    },
    {
      $project: { email: 1, walletBalance: 1, 'walletInfo.balance': 1 }
    }
  ]);
  console.log(JSON.stringify(res, null, 2));
  await app.close();
}
bootstrap();
