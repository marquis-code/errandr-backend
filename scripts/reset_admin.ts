import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { User, UserRole } from '../src/modules/users/schemas/user.schema';
import * as bcrypt from 'bcryptjs';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userModel = app.get(getModelToken(User.name));

  const email = 'admin@erranders.org';
  const password = 'Password123!';

  let admin = await userModel.findOne({ email });
  
  const hashedPassword = await bcrypt.hash(password, 12);

  if (admin) {
    admin.password = hashedPassword;
    admin.role = UserRole.ADMIN;
    await admin.save();
    console.log(`Admin password reset. Login with: ${email} / ${password}`);
  } else {
    admin = await userModel.create({
      email,
      firstName: 'System',
      lastName: 'Admin',
      password: hashedPassword,
      role: UserRole.ADMIN,
      isVerified: true,
    });
    console.log(`Admin created. Login with: ${email} / ${password}`);
  }
  
  await app.close();
  process.exit(0);
}

bootstrap();
