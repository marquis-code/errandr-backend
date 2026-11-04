import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ErrandersService } from './erranders.service';
import { ErrandersController } from './erranders.controller';
import { NinjaShiftsService } from './ninja-shifts.service';
import { Errander, ErranderSchema } from './schemas/errander.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { SystemSetting, SystemSettingSchema } from '../admin/schemas/system-setting.schema';
import { RewardsModule } from '../rewards/rewards.module';
import { EmailModule } from '../email/email.module';
import { InstitutionsModule } from '../institutions/institutions.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Errander.name, schema: ErranderSchema },
      { name: User.name, schema: UserSchema },
      { name: SystemSetting.name, schema: SystemSettingSchema },
    ]),
    RewardsModule,
    EmailModule,
    // Exports InstitutionResolver so rider lists can be scoped to a campus.
    InstitutionsModule,
  ],
  controllers: [ErrandersController],
  providers: [ErrandersService, NinjaShiftsService],
  exports: [ErrandersService, NinjaShiftsService],
})
export class ErrandersModule {}
