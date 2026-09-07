import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const packModel = app.get<Model<any>>(getModelToken('MenuPack'));
    const pack = await packModel.findById('6a8b022a9a228e463a9365a2');
    console.log('Combo imageUrl:', pack.imageUrl);
    console.log('Combo image:', pack.image);
    console.log('Combo images:', pack.images);
  } catch (e) {
    console.log(e);
  }
  await app.close();
}
bootstrap();
