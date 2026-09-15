import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { OrdersService } from '../src/modules/orders/orders.service';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../src/modules/users/schemas/user.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const ordersService = app.get(OrdersService);
  const userModel = app.get<Model<User>>(getModelToken(User.name));

  const orderId = '6aa7c84c89b482b6196d3b97';
  
  // Find Francisvix
  const user = await userModel.findOne({ firstName: { $regex: /Francisvix/i } });
  
  if (!user) {
    console.error('Could not find user Francisvix');
    process.exit(1);
  }
  
  console.log(`Found Francisvix: ${user._id}`);
  
  try {
    const result = await ordersService.acceptOrder(orderId, user._id.toString(), true);
    console.log('Successfully assigned order:', result.orderNumber);
  } catch (error) {
    console.error('Error assigning order:', error.message);
  }

  await app.close();
}
bootstrap();
