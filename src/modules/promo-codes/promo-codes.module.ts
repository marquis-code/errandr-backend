import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PromoCodesService } from './promo-codes.service';
import { PromoCodesController } from './promo-codes.controller';
import { PromoCode, PromoCodeSchema } from './schemas/promo-code.schema';
import { PromoRedemption, PromoRedemptionSchema } from './schemas/promo-redemption.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Facilitator, FacilitatorSchema } from '../referrals/schemas/facilitator.schema';
import { Referral, ReferralSchema } from '../referrals/schemas/referral.schema';
import { EmailModule } from '../email/email.module';
import { WalletsModule } from '../wallets/wallets.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PromoCode.name, schema: PromoCodeSchema },
      { name: PromoRedemption.name, schema: PromoRedemptionSchema },
      { name: User.name, schema: UserSchema },
      { name: Facilitator.name, schema: FacilitatorSchema },
      { name: Referral.name, schema: ReferralSchema },
    ]),
    EmailModule,
    forwardRef(() => WalletsModule),
  ],
  controllers: [PromoCodesController],
  providers: [PromoCodesService],
  exports: [PromoCodesService],
})
export class PromoCodesModule {}

