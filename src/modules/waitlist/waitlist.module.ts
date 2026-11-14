import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Schema } from 'mongoose';
import { WaitlistForm, WaitlistFormSchema, WaitlistResponse, WaitlistResponseSchema } from './schemas/waitlist.schema';
import { WaitlistService } from './waitlist.service';
import { WaitlistController, WaitlistAdminController } from './waitlist.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WaitlistForm.name, schema: WaitlistFormSchema },
      { name: WaitlistResponse.name, schema: WaitlistResponseSchema },
      { name: 'Vendor', schema: new Schema({}, { strict: false, collection: 'vendors' }) },
    ]),
    NotificationsModule,
    EmailModule,
  ],
  controllers: [WaitlistController, WaitlistAdminController],
  providers: [WaitlistService],
  exports: [WaitlistService],
})
export class WaitlistModule {}
