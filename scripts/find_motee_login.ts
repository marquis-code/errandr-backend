import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Vendor } from '../src/modules/vendors/schemas/vendor.schema';
import { User } from '../src/modules/users/schemas/user.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const vendorModel = app.get<Model<Vendor>>(getModelToken(Vendor.name));
  const userModel = app.get<Model<User>>(getModelToken(User.name));

  const vendors = await vendorModel.find({ storeName: /motee/i });
  for (const vendor of vendors) {
    const owner = await userModel.findById(vendor.owner);
    console.log(`Vendor: ${vendor.storeName}, Email: ${owner?.email}`);
  }

  await app.close();
  process.exit(0);
}
bootstrap();
