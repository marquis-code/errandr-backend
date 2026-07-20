import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PushCampaignsService } from './push-campaigns.service';
import { PushCampaignsController } from './push-campaigns.controller';
import { PushCampaign, PushCampaignSchema } from './schemas/push-campaign.schema';
import { UsersModule } from '../users/users.module';
import { VendorsModule } from '../vendors/vendors.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: PushCampaign.name, schema: PushCampaignSchema }]),
    UsersModule,
    VendorsModule,
  ],
  controllers: [PushCampaignsController],
  providers: [PushCampaignsService],
  exports: [PushCampaignsService],
})
export class PushCampaignsModule {}
