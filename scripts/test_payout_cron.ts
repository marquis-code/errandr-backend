import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { WalletsCronService } from '../src/modules/wallets/wallets.cron';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const walletsCronService = app.get(WalletsCronService);

  console.log('Manually triggering daily payouts...');
  await walletsCronService.processDailyPayouts();
  console.log('Finished.');

  await app.close();
  process.exit(0);
}
bootstrap();
