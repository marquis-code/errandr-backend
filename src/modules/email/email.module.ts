import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EmailService } from './email.service';
import { SystemSetting, SystemSettingSchema } from '../admin/schemas/system-setting.schema';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([{ name: SystemSetting.name, schema: SystemSettingSchema }]),
  ],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
