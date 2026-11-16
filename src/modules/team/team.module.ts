import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';
import { TeamMember, TeamMemberSchema } from './schemas/team-member.schema';
import { Vendor, VendorSchema } from '../vendors/schemas/vendor.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Appointment, AppointmentSchema } from '../appointments/schemas/appointment.schema';
import { Wallet, WalletSchema } from '../wallets/schemas/wallet.schema';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TeamMember.name, schema: TeamMemberSchema },
      { name: Vendor.name, schema: VendorSchema },
      { name: User.name, schema: UserSchema },
      { name: Appointment.name, schema: AppointmentSchema },
      { name: Wallet.name, schema: WalletSchema },
    ]),
    EmailModule,
    NotificationsModule,
  ],
  controllers: [TeamController],
  providers: [TeamService],
  exports: [TeamService, MongooseModule],
})
export class TeamModule {}
