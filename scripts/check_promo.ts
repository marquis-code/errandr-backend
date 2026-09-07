import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PromoCode } from '../src/modules/promo-codes/schemas/promo-code.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const PromoCodeModel = app.get<Model<PromoCode>>(getModelToken('PromoCode'));

  const promo = await PromoCodeModel.findOne({ code: 'TEST001' });
  console.log(JSON.stringify(promo, null, 2));

  await app.close();
}

bootstrap();
