import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { AdminService } from './src/modules/admin/admin.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const adminService = app.get(AdminService);
  
  const result = await adminService.getDispatcher('6a80845225f366e9d3656366');
  console.log("Dispatcher returned:", result ? Object.keys(result.toObject()) : 'null');
  await app.close();
}
bootstrap();
