import { Module, forwardRef } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { KorapayService } from './korapay.service';
import { PaystackService } from './paystack.service';
import { OrdersModule } from '../orders/orders.module';
import { WalletsModule } from '../wallets/wallets.module';

@Module({
  imports: [
    forwardRef(() => OrdersModule),
    forwardRef(() => WalletsModule),
  ],
  providers: [KorapayService, PaystackService],
  controllers: [PaymentsController],
  exports: [KorapayService, PaystackService],
})
export class PaymentsModule {}
