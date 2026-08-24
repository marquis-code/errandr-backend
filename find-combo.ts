import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  // Find out what models we have for items/combos
  
  // We can just log all model names to figure it out first
  // Actually, Mongoose stores deleted documents? Probably not unless soft delete.
  // Let's check schemas
  await app.close();
}
bootstrap();
