import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../src/modules/users/schemas/user.schema';
import { MenuItemService } from '../src/modules/menu/menu-item.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userModel = app.get<Model<User>>(getModelToken(User.name));
  const menuItemService = app.get(MenuItemService);
  
  const user: any = await userModel.findOne({ email: 'blessingidowu1991@gmail.com' });
  if (user) {
    try {
      console.log(`Testing findByOwner for User ID: ${user._id}`);
      const items = await menuItemService.findByOwner(user._id.toString());
      console.log(`Found ${items.length} items`);
    } catch (e: any) {
      console.error('Error:', e.message);
    }
  } else {
    console.log('User not found.');
  }

  await app.close();
  process.exit(0);
}
bootstrap();
