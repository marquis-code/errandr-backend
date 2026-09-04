import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MarketPoolController } from './market-pool.controller';
import { MarketPoolService } from './market-pool.service';
import { MarketPoolCampaign, MarketPoolCampaignSchema } from './schemas/market-pool-campaign.schema';
import { MarketPoolItem, MarketPoolItemSchema } from './schemas/market-pool-item.schema';
import { MarketPoolOrder, MarketPoolOrderSchema } from './schemas/market-pool-order.schema';
import { MarketPoolCustomRequest, MarketPoolCustomRequestSchema } from './schemas/market-pool-custom-request.schema';
import { MarketPoolCategory, MarketPoolCategorySchema } from './schemas/market-pool-category.schema';
import { SystemSetting, SystemSettingSchema } from '../admin/schemas/system-setting.schema';
import { WalletsModule } from '../wallets/wallets.module';
import { EmailModule } from '../email/email.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MarketPoolCampaign.name, schema: MarketPoolCampaignSchema },
      { name: MarketPoolItem.name, schema: MarketPoolItemSchema },
      { name: MarketPoolOrder.name, schema: MarketPoolOrderSchema },
      { name: MarketPoolCustomRequest.name, schema: MarketPoolCustomRequestSchema },
      { name: MarketPoolCategory.name, schema: MarketPoolCategorySchema },
      { name: SystemSetting.name, schema: SystemSettingSchema },
    ]),
    WalletsModule,
    EmailModule,
    UsersModule,
    NotificationsModule,
  ],
  controllers: [MarketPoolController],
  providers: [MarketPoolService],
})
export class MarketPoolModule {}
