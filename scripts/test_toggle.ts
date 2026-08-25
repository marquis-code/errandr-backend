import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { VendorsService } from '../src/modules/vendors/vendors.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  try {
    const service = app.get(VendorsService);
    // test with an admin user object
    const user = { _id: 'some-id', role: 'admin' } as any;
    
    await service.toggleOnline('6a89dd8efafcc95c3a312edf', user);
    console.log('Toggle online successful');
  } catch (error) {
    console.error('Script failed:', error);
  } finally {
    await app.close();
  }
}
bootstrap();
