import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReferralsService } from './referrals.service';
import { ReferralsController } from './referrals.controller';
import { ReferralsPublicController } from './referrals.public.controller';
import { Referral, ReferralSchema } from './schemas/referral.schema';
import { Facilitator, FacilitatorSchema } from './schemas/facilitator.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Referral.name, schema: ReferralSchema },
      { name: Facilitator.name, schema: FacilitatorSchema },
      { name: User.name, schema: UserSchema },
    ]),
    EmailModule,
  ],
  controllers: [ReferralsController, ReferralsPublicController],
  providers: [ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}
