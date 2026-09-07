import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AppointmentsService } from '../src/modules/appointments/appointments.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(AppointmentsService);
  
  const apts = await service.findAllForUser('6a6dbd87127e11af510ac0cd');
  console.log('Appointments for user:', JSON.stringify(apts, null, 2));
  
  await app.close();
}
bootstrap();
