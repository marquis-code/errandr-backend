import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Vendor } from '../src/modules/vendors/schemas/vendor.schema';
import { Order } from '../src/modules/orders/schemas/order.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const vendorModel = app.get<Model<Vendor>>(getModelToken(Vendor.name));
  const orderModel = app.get<Model<Order>>(getModelToken(Order.name));

  const ownerId = '69bf1be57bd24adc3fce8de6'; // Iya Chidera user ID
  const vendorId = '69bed22cce3c828e98beb438'; // Iya Chidera vendor ID

  const vendors = await vendorModel.find({ owner: new Types.ObjectId(ownerId) });
  console.log('Vendors owned by Iya Chidera:', vendors.map(v => ({ id: v._id, name: v.storeName })));

  const orders = await orderModel.find({ vendor: new Types.ObjectId(vendorId) });
  console.log('Orders for Iya Chidera vendor:', orders.length);
  if (orders.length > 0) {
    console.log('Sample Order Status:', orders[0].status);
  }

  await app.close();
  process.exit(0);
}
bootstrap();
