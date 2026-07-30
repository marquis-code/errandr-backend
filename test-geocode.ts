import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { MapboxService } from './src/modules/mapbox/mapbox.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const mapboxService = app.get(MapboxService);
  const geocoded1 = await mapboxService.geocode('Lagos University Teaching Hospital');
  console.log('LUTH Coords:', geocoded1);
  const geocoded2 = await mapboxService.geocode('College of medicine university of lagos idiaraba');
  console.log('CMUL Coords:', geocoded2);
  await app.close();
}
bootstrap();
