import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MarketPoolController } from './market-pool.controller';
import { MarketPoolService } from './market-pool.service';
import { MarketPoolCampaign, MarketPoolCampaignSchema } from './schemas/market-pool-campaign.schema';
import { MarketPoolItem, MarketPoolItemSchema } from './schemas/market-pool-item.schema';
import { MarketPoolOrder, MarketPoolOrderSchema } from './schemas/market-pool-order.schema';
import { WalletsModule } from '../wallets/wallets.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MarketPoolCampaign.name, schema: MarketPoolCampaignSchema },
      { name: MarketPoolItem.name, schema: MarketPoolItemSchema },
      { name: MarketPoolOrder.name, schema: MarketPoolOrderSchema },
    ]),
    WalletsModule,
  ],
  controllers: [MarketPoolController],
  providers: [MarketPoolService],
})
export class MarketPoolModule {}
