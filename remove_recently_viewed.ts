import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { User } from './src/modules/users/schemas/user.schema';
import { Vendor } from './src/modules/vendors/schemas/vendor.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const vendorModel = app.get<Model<Vendor>>(getModelToken(Vendor.name));
  const userModel = app.get<Model<User>>(getModelToken(User.name));

  const names = ['The Love Bridge treats', 'Kicks by Tobi', 'Mimi Pastries', 'Brandy Lashes'];
  
  const vendors = await vendorModel.find({ storeName: { $in: names.map(n => new RegExp(n, 'i')) } });
  const vendorIds = vendors.map(v => v._id);
  
  console.log(`Found vendors to remove:`, vendors.map(v => v.storeName));
  
  if (vendorIds.length > 0) {
     const result = await userModel.updateMany(
       {},
       { $pull: { recentlyViewed: { vendor: { $in: vendorIds } } } }
     );
     console.log(`Removed from ${result.modifiedCount} users.`);
  } else {
     console.log('No vendors found.');
  }

  await app.close();
}
bootstrap();
