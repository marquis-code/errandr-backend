import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getConnectionToken } from '@nestjs/mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const connection = app.get(getConnectionToken());
  const collections = await connection.db.collections();
  
  const id = '6a6dbd87127e11af510ac0cd';
  const { Types } = require('mongoose');
  const objectId = new Types.ObjectId(id);
  
  for (const collection of collections) {
    const doc = await collection.findOne({ _id: objectId });
    if (doc) {
      console.log(`Found in collection: ${collection.collectionName}`, doc);
    }
  }
  console.log('Search complete.');
  
  await app.close();
}
bootstrap();
