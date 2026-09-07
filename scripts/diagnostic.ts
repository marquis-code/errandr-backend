
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Vendor } from '../src/modules/vendors/schemas/vendor.schema';
import { User } from '../src/modules/users/schemas/user.schema';
import { Order } from '../src/modules/orders/schemas/order.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const vendorModel = app.get<Model<Vendor>>(getModelToken(Vendor.name));
  const userModel = app.get<Model<User>>(getModelToken(User.name));
  const orderModel = app.get<Model<Order>>(getModelToken(Order.name));

  console.log('--- DIAGNOSTIC START ---');

  const users = await userModel.find().limit(5);
  console.log('Sample Users:', users.map(u => ({ id: u._id, email: u.email, role: u.role })));

  const vendors = await vendorModel.find().limit(5);
  console.log('Sample Vendors:', vendors.map(v => ({ id: v._id, storeName: v.storeName, owner: v.owner })));

  const orders = await orderModel.find().limit(5);
  console.log('Sample Orders:', orders.map(o => ({ id: o._id, number: o.orderNumber, vendor: o.vendor, customer: o.customer, status: o.status })));

  // Check for specific vendor mentioned in user request
  const specificVendor = await vendorModel.findById('69bed22cce3c828e98beb438');
  if (specificVendor) {
    console.log('Specific Vendor Found:', { id: specificVendor._id, storeName: specificVendor.storeName, owner: specificVendor.owner });
    const owner = await userModel.findById(specificVendor.owner);
    console.log('Owner of Specific Vendor:', owner ? { id: owner._id, email: owner.email } : 'OWNER NOT FOUND');
    
    const vendorOrders = await orderModel.find({ vendor: specificVendor._id });
    console.log(`Orders for Specific Vendor (${specificVendor._id}):`, vendorOrders.length);
  } else {
    console.log('Specific Vendor 69bed22cce3c828e98beb438 NOT FOUND');
  }

  console.log('--- DIAGNOSTIC END ---');
  await app.close();
}

bootstrap();
