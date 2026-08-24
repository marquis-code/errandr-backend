import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const userModel = app.get('UserModel');
    const vendorModel = app.get('VendorModel');
    
    const user = await userModel.findOne({ email: "smoothiedaddi@luth.com" });
    if(user) {
        console.log("User:", user._id);
        const vendor = await vendorModel.findOne({ owner: user._id });
        if(vendor) {
            console.log("Vendor found! ID:", vendor._id);
        } else {
            console.log("Vendor not found for user.");
        }
    } else {
        console.log("User not found.");
    }
  } catch(e) {
     console.error(e);
  }
  await app.close();
}
bootstrap();
