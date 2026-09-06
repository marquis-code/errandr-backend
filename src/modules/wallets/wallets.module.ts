import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WalletsService } from './wallets.service';
import { WalletsController } from './wallets.controller';
import { Wallet, WalletSchema } from './schemas/wallet.schema';
import { Transaction, TransactionSchema } from './schemas/transaction.schema';
import { forwardRef } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { EmailModule } from '../email/email.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { WalletsCronService } from './wallets.cron';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Vendor, VendorSchema } from '../vendors/schemas/vendor.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Wallet.name, schema: WalletSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: User.name, schema: UserSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Vendor.name, schema: VendorSchema },
    ]),
    forwardRef(() => PaymentsModule),
    EmailModule,
  ],
  providers: [WalletsService, WalletsCronService],
  controllers: [WalletsController],
  exports: [WalletsService, WalletsCronService],
})
export class WalletsModule {}
