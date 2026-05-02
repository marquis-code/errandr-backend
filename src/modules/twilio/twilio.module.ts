import { Module, Global, forwardRef } from '@nestjs/common';
import { TwilioService } from './twilio.service';
import { TwilioController } from './twilio.controller';
import { OrdersModule } from '../orders/orders.module';

@Global()
@Module({
  imports: [forwardRef(() => OrdersModule)],
  controllers: [TwilioController],
  providers: [TwilioService],
  exports: [TwilioService],
})
export class TwilioModule {}
