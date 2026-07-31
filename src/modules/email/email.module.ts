import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EmailService } from './email.service';
import { SystemSetting, SystemSettingSchema } from '../admin/schemas/system-setting.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Vendor, VendorSchema } from '../vendors/schemas/vendor.schema';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SystemSetting.name, schema: SystemSettingSchema },
      { name: User.name, schema: UserSchema },
      { name: Vendor.name, schema: VendorSchema },
    ]),
  ],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
