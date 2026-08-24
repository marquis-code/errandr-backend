import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const itemModel = app.get<Model<any>>(getModelToken('MenuItem'));
    const items = await itemModel.find({ vendorId: '6a4e4ba65be2071e52785438' });
    console.log(`Found ${items.length} items for vendor.`);
    for (const i of items) {
       console.log(`- ${i.name} (ID: ${i._id}) | deleted: ${i.isDeleted} | deletedAt: ${i.deletedAt}`);
    }
  } catch (e) {
    console.log(e);
  }
  await app.close();
}
bootstrap();
