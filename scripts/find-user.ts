import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { UsersService } from '../src/modules/users/users.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);
  
  try {
    const user = await usersService.findById('6a6dbd87127e11af510ac0cd');
    console.log('User found:', user ? user._id : 'Not found');
  } catch (e) {
    console.log('Error User:', e.message);
  }
  
  await app.close();
}
bootstrap();
