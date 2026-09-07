import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PromoCodesService } from '../src/modules/promo-codes/promo-codes.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(PromoCodesService);

  const res = await service.previewCode('ADMIN001', 400, '6a5fcde64a331e5430a9728f', '6a4e4ba65be2071e52785438', 0, { isGroupOrder: true, locationType: 'inside_campus' });
  console.log(JSON.stringify(res, null, 2));

  await app.close();
}
bootstrap();
