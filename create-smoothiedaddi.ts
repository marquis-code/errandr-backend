import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { AuthService } from './src/modules/auth/auth.service';
import { VendorsService } from './src/modules/vendors/vendors.service';
import { UserRole } from './src/modules/users/schemas/user.schema';
import { VendorCategory, BusinessType, VendorStatus } from './src/modules/vendors/schemas/vendor.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const authService = app.get(AuthService);
    const vendorsService = app.get(VendorsService);

    const password = "SmoothieDaddi2026!";
    const email = "smoothiedaddi@luth.com";
    
    let user;
    const userModel = app.get('UserModel');
    user = await userModel.findOne({ email });

    if(user && user._id) {
        console.log("Creating Vendor profile...");
        const vendorData = {
            storeName: "SmoothieDaddi",
            description: "Fresh fruit smoothies, parfaits, sandwiches, and small chops packs.",
            phone: "08078983638",
            address: "Shop 6, OPH Shopping Plaza, LUTH, Idi-Araba, Lagos", // Fixed address to string
            businessType: BusinessType.PHYSICAL_PRODUCT,
            category: VendorCategory.RESTAURANT,
            status: VendorStatus.APPROVED,
            isInsideCampus: true,
            isStudentBusiness: false,
            isOpen: true
        };
        const vendor = await vendorsService.create((user._id as unknown) as string, vendorData as any);
        console.log("Created vendor:", vendor._id);
        console.log("Email:", email);
        console.log("Password:", password);
    }
  } catch (e) {
    console.error(e);
  }
  await app.close();
}
bootstrap();
