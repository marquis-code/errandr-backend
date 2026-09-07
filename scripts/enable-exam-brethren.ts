import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SystemSetting } from '../src/modules/admin/schemas/system-setting.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const settingModel = app.get<Model<SystemSetting>>(getModelToken(SystemSetting.name));

  console.log('Enabling exam brethren campaign...');
  
  await settingModel.updateOne(
    { key: 'exam_brethren_campaign' },
    { $set: { "value.isActive": true } },
    { upsert: true }
  );

  console.log('Done!');
  
  await app.close();
}

bootstrap();
