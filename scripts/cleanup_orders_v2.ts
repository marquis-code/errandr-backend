import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const OrderModel = app.get<Model<any>>(getModelToken('Order'));
  const DeliveryBidModel = app.get<Model<any>>(getModelToken('DeliveryBid'));

  // Check both cases
  const upperNeg = await OrderModel.countDocuments({ status: 'NEGOTIATING' });
  const lowerNeg = await OrderModel.countDocuments({ status: 'negotiating' });
  const upperAwait = await OrderModel.countDocuments({ status: 'AWAITING_PAYMENT' });
  const lowerAwait = await OrderModel.countDocuments({ status: 'awaiting_payment' });
  console.log(`NEGOTIATING(upper): ${upperNeg}, negotiating(lower): ${lowerNeg}`);
  console.log(`AWAITING_PAYMENT(upper): ${upperAwait}, awaiting_payment(lower): ${lowerAwait}`);

  // Cancel ALL negotiating/awaiting orders (both cases)
  const toCancel = await OrderModel.find({ 
    status: { $in: ['NEGOTIATING', 'negotiating', 'AWAITING_PAYMENT', 'awaiting_payment', 'PENDING', 'pending'] }
  });
  console.log(`\nTotal orders to cancel: ${toCancel.length}`);

  const orderIds = toCancel.map(o => o._id);

  const result = await OrderModel.updateMany(
    { _id: { $in: orderIds } },
    { 
      $set: { status: 'cancelled', cancelReason: 'Bulk cleanup of test orders' },
      $push: { statusHistory: { status: 'cancelled', timestamp: new Date(), note: 'Bulk cleanup of test orders' } }
    }
  );
  console.log(`Cancelled ${result.modifiedCount} orders`);

  // Clean delivery bids
  if (orderIds.length > 0) {
    const bidResult = await DeliveryBidModel.deleteMany({ order: { $in: orderIds } });
    console.log(`Cleaned up ${bidResult.deletedCount} delivery bids`);
  }

  // Verify
  const remaining = await OrderModel.countDocuments({ 
    status: { $in: ['NEGOTIATING', 'negotiating', 'AWAITING_PAYMENT', 'awaiting_payment', 'PENDING', 'pending'] }
  });
  console.log(`\nRemaining active orders: ${remaining}`);

  await app.close();
  console.log('Done!');
}
bootstrap();
