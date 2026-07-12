import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { SettingsController } from './settings.controller';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Vendor, VendorSchema } from '../vendors/schemas/vendor.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Errander, ErranderSchema } from '../erranders/schemas/errander.schema';
import { Report, ReportSchema } from '../reports/schemas/report.schema';
import { SystemSetting, SystemSettingSchema } from './schemas/system-setting.schema';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Vendor.name, schema: VendorSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Errander.name, schema: ErranderSchema },
      { name: Report.name, schema: ReportSchema },
      { name: SystemSetting.name, schema: SystemSettingSchema },
    ]),
    EmailModule,
  ],
  controllers: [AdminController, SettingsController],
  providers: [AdminService],
})
export class AdminModule {}
