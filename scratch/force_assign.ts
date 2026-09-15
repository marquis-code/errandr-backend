import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderStatus } from '../src/modules/orders/schemas/order.schema';
import { User } from '../src/modules/users/schemas/user.schema';
import { OrdersService } from '../src/modules/orders/orders.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const orderModel = app.get<Model<Order>>(getModelToken(Order.name));
  const userModel = app.get<Model<User>>(getModelToken(User.name));
  const ordersService = app.get(OrdersService);

  const orderNumber = 'ERR-D6397A32';
  
  // Find order
  const order = await orderModel.findOne({ orderNumber });
  if (!order) {
    console.log('Order not found');
    process.exit(1);
  }

  // Find Francisvix
  const user = await userModel.findOne({ firstName: { $regex: /Francisvix/i } });
  if (!user) {
    console.log('Francisvix not found');
    process.exit(1);
  }

  console.log(`Current status: ${order.status}`);
  
  // Temporarily reset status if it's terminal
  if (['delivered', 'cancelled', 'refunded'].includes(order.status)) {
    console.log('Resetting order status to preparing...');
    await orderModel.updateOne(
      { _id: order._id },
      { $set: { status: OrderStatus.PREPARING } }
    );
  }

  // Use the service to assign, which handles all side-effects (notifications, etc)
  try {
    const result = await ordersService.acceptOrder(order._id.toString(), user._id.toString(), true);
    console.log(`Successfully assigned order ${result.orderNumber} to ${user.firstName}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }

  await app.close();
  process.exit(0);
}
bootstrap();
