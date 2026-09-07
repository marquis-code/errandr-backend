import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PromoCode } from '../src/modules/promo-codes/schemas/promo-code.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const PromoCodeModel = app.get<Model<PromoCode>>(getModelToken('PromoCode'));

  const promos = await PromoCodeModel.find().lean();
  console.log(JSON.stringify(promos[0], null, 2));

  await app.close();
}

bootstrap();
