import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const itemModel = app.get<Model<any>>(getModelToken('MenuItem'));
    const beans = await itemModel.findById('6a81583011fb20dd60e65d1c');
    const beef = await itemModel.findById('6a81583111fb20dd60e65d39');
    console.log('Beans:', beans);
    console.log('Beef:', beef);
  } catch (e) {
    console.log(e);
  }
  await app.close();
}
bootstrap();
