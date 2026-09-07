import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MenuPackService } from './src/modules/menu/menu-pack.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const packService = app.get(MenuPackService);
    const packs = await packService.findByVendor('6a4e4ba65be2071e52785438');
    const pack = packs.find(p => p.name === 'Exam Combo');
    console.log('API returned pack imageUrl:', pack?.imageUrl);
    console.log('API returned pack components[0]:', pack?.components?.[0]);
  } catch (e) {
    console.log(e);
  }
  await app.close();
}
bootstrap();
