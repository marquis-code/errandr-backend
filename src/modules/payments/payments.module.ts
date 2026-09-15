import { Module, forwardRef } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaystackService } from './paystack.service';
import { OrdersModule } from '../orders/orders.module';
import { WalletsModule } from '../wallets/wallets.module';
import { EmailModule } from '../email/email.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { UsersModule } from '../users/users.module';
import { MarketPoolModule } from '../market-pool/market-pool.module';

@Module({
  imports: [
    forwardRef(() => OrdersModule),
    forwardRef(() => WalletsModule),
    forwardRef(() => AppointmentsModule),
    forwardRef(() => MarketPoolModule),
    EmailModule,
    UsersModule,
  ],
  providers: [PaystackService],
  controllers: [PaymentsController],
  exports: [PaystackService],
})
export class PaymentsModule {}
