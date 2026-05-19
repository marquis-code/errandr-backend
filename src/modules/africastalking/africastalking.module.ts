import { Module, forwardRef } from '@nestjs/common';
import { AfricasTalkingService } from './africastalking.service';
import { AfricasTalkingController } from './africastalking.controller';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [forwardRef(() => OrdersModule)],
  controllers: [AfricasTalkingController],
  providers: [AfricasTalkingService],
  exports: [AfricasTalkingService],
})
export class AfricasTalkingModule {}
