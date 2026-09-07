import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const itemModel = app.get<Model<any>>(getModelToken('MenuItem'));
    const plantain = await itemModel.findOne({ _id: '6a67a089f590d198be2bf768' });
    console.log('Old Plantain:', plantain);
  } catch (e) {
    console.log(e);
  }
  await app.close();
}
bootstrap();
