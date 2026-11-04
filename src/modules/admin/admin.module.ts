import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Schema } from 'mongoose';
import { AmbassadorsService } from './ambassadors.service';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { SettingsController } from './settings.controller';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Vendor, VendorSchema } from '../vendors/schemas/vendor.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Errander, ErranderSchema } from '../erranders/schemas/errander.schema';
import { Report, ReportSchema } from '../reports/schemas/report.schema';
import { SystemSetting, SystemSettingSchema } from './schemas/system-setting.schema';
import { Appointment, AppointmentSchema } from '../appointments/schemas/appointment.schema';
import { Wallet, WalletSchema } from '../wallets/schemas/wallet.schema';
import { Transaction, TransactionSchema } from '../wallets/schemas/transaction.schema';
import { Facilitator, FacilitatorSchema } from '../referrals/schemas/facilitator.schema';
import { Referral, ReferralSchema } from '../referrals/schemas/referral.schema';
import { PromoCode, PromoCodeSchema } from '../promo-codes/schemas/promo-code.schema';
import { PromoRedemption, PromoRedemptionSchema } from '../promo-codes/schemas/promo-redemption.schema';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Vendor.name, schema: VendorSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Errander.name, schema: ErranderSchema },
      { name: Report.name, schema: ReportSchema },
      { name: SystemSetting.name, schema: SystemSettingSchema },
      { name: Appointment.name, schema: AppointmentSchema },
      { name: Facilitator.name, schema: FacilitatorSchema },
      { name: Referral.name, schema: ReferralSchema },
      { name: PromoCode.name, schema: PromoCodeSchema },
      { name: PromoRedemption.name, schema: PromoRedemptionSchema },
      { name: Wallet.name, schema: WalletSchema },
      { name: Transaction.name, schema: TransactionSchema },
    ]),
    forwardRef(() => NotificationsModule),
    EmailModule,
  ],
  controllers: [AdminController, SettingsController],
  providers: [AmbassadorsService, AdminService],
  exports: [AdminService],
})
export class AdminModule {}
