import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AppointmentsService } from '../src/modules/appointments/appointments.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(AppointmentsService);
  
  const apts = await (service as any).appointmentModel.find().limit(5);
  console.log('Appointments vendors:', apts.map(a => a.vendor));
  
  await app.close();
}
bootstrap();
