import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { AdminService } from './src/modules/admin/admin.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const adminService = app.get(AdminService);
  
  const result = await adminService.getRecentOrders(1, 10, undefined, undefined, undefined, undefined, undefined, '6a80843625f366e9d3656331');
  console.log("Orders returned by adminService:", result.orders.length);
  await app.close();
}
bootstrap();
