import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const OrderModel = app.get<Model<any>>(getModelToken('Order'));
  const DeliveryBidModel = app.get<Model<any>>(getModelToken('DeliveryBid'));

  // Cancel all NEGOTIATING orders
  const negotiating = await OrderModel.find({ status: 'NEGOTIATING' });
  console.log(`Found ${negotiating.length} NEGOTIATING orders`);

  for (const order of negotiating) {
    order.status = 'CANCELLED';
    order.cancelReason = 'Bulk cleanup of test orders';
    order.statusHistory.push({
      status: 'CANCELLED',
      timestamp: new Date(),
      note: 'Bulk cleanup of test orders',
    });
    await order.save();
  }
  console.log(`Cancelled ${negotiating.length} NEGOTIATING orders`);

  // Cancel all AWAITING_PAYMENT orders
  const awaiting = await OrderModel.find({ status: 'AWAITING_PAYMENT' });
  console.log(`Found ${awaiting.length} AWAITING_PAYMENT orders`);

  for (const order of awaiting) {
    order.status = 'CANCELLED';
    order.cancelReason = 'Bulk cleanup of test orders';
    order.statusHistory.push({
      status: 'CANCELLED',
      timestamp: new Date(),
      note: 'Bulk cleanup of test orders',
    });
    await order.save();
  }
  console.log(`Cancelled ${awaiting.length} AWAITING_PAYMENT orders`);

  // Clean up delivery bids
  const orderIds = [...negotiating, ...awaiting].map(o => o._id);
  if (orderIds.length > 0) {
    const bidResult = await DeliveryBidModel.deleteMany({ order: { $in: orderIds } });
    console.log(`Cleaned up ${bidResult.deletedCount} delivery bids`);
  }

  await app.close();
  console.log('Done!');
}

bootstrap();
