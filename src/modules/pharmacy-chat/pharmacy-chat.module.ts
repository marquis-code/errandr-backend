import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PharmacyConversation, PharmacyConversationSchema } from './schemas/pharmacy-conversation.schema';
import { PharmacyChatService } from './pharmacy-chat.service';
import { PharmacyChatController } from './pharmacy-chat.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { Schema } from 'mongoose';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PharmacyConversation.name, schema: PharmacyConversationSchema },
      { name: 'Vendor', schema: new Schema({}, { strict: false, collection: 'vendors' }) },
      { name: 'Product', schema: new Schema({}, { strict: false, collection: 'products' }) },
      { name: 'User', schema: new Schema({}, { strict: false, collection: 'users' }) },
    ]),
    NotificationsModule,
  ],
  controllers: [PharmacyChatController],
  providers: [PharmacyChatService],
  exports: [PharmacyChatService],
})
export class PharmacyChatModule {}
