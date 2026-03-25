import { Module, forwardRef } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaystackService } from './paystack.service';
import { OrdersModule } from '../orders/orders.module';
import { WalletsModule } from '../wallets/wallets.module';

@Module({
  imports: [
    forwardRef(() => OrdersModule),
    forwardRef(() => WalletsModule),
  ],
  providers: [PaystackService],
  controllers: [PaymentsController],
  exports: [PaystackService],
})
export class PaymentsModule {}
