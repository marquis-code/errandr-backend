import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getConnectionToken } from '@nestjs/mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const connection = app.get(getConnectionToken());
  
  try {
    const collection = connection.db.collection('favorites');
    await collection.dropIndex('user_1_product_1');
    console.log('Successfully dropped old user_1_product_1 index');
  } catch (e) {
    console.log('Index might not exist or error:', e.message);
  }
  
  await app.close();
  process.exit(0);
}
bootstrap();
