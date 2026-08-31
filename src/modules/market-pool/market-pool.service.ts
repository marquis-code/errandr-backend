import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MarketPoolCampaign, MarketPoolCampaignStatus } from './schemas/market-pool-campaign.schema';
import { MarketPoolItem } from './schemas/market-pool-item.schema';
import { MarketPoolOrder, MarketPoolOrderStatus } from './schemas/market-pool-order.schema';
import { WalletsService } from '../wallets/wallets.service';

@Injectable()
export class MarketPoolService {
  private readonly logger = new Logger(MarketPoolService.name);

  constructor(
    @InjectModel(MarketPoolCampaign.name) private campaignModel: Model<MarketPoolCampaign>,
    @InjectModel(MarketPoolItem.name) private itemModel: Model<MarketPoolItem>,
    @InjectModel(MarketPoolOrder.name) private orderModel: Model<MarketPoolOrder>,
    private walletsService: WalletsService,
  ) {}

  async createCampaign(title: string, startDate: Date, endDate: Date): Promise<MarketPoolCampaign> {
    return this.campaignModel.create({ title, startDate, endDate });
  }

  async getActiveCampaign(): Promise<MarketPoolCampaign | null> {
    return this.campaignModel.findOne({ status: MarketPoolCampaignStatus.OPEN }).sort({ createdAt: -1 });
  }

  async addItem(campaignId: string, data: any): Promise<MarketPoolItem> {
    return this.itemModel.create({ campaignId, ...data });
  }

  async getCampaignItems(campaignId: string): Promise<MarketPoolItem[]> {
    return this.itemModel.find({ campaignId });
  }

  async checkout(userId: string, campaignId: string, items: { itemId: string, quantity: number }[]): Promise<MarketPoolOrder> {
    const campaign = await this.campaignModel.findById(campaignId);
    if (!campaign || campaign.status !== MarketPoolCampaignStatus.OPEN) {
      throw new BadRequestException('Campaign is not open');
    }

    let totalItemCost = 0;
    const orderItems: any[] = [];

    for (const item of items) {
      const dbItem = await this.itemModel.findById(item.itemId);
      if (!dbItem) throw new NotFoundException(`Item ${item.itemId} not found`);
      totalItemCost += dbItem.appPrice * item.quantity;
      orderItems.push({
        itemId: dbItem._id,
        quantity: item.quantity,
        priceAtPurchase: dbItem.appPrice,
      });
    }

    const deliveryFee = 500; // Flat delivery fee
    const total = totalItemCost + deliveryFee;

    // Deduct from wallet (Assuming wallet payment for now)
    const wallet = await this.walletsService.getOrCreateWallet(userId);
    if (wallet.balance < total) {
      throw new BadRequestException('Insufficient wallet balance');
    }
    
    // Simulate charging wallet directly for simplicity in this implementation
    wallet.balance -= total;
    await wallet.save();

    return this.orderModel.create({
      campaignId,
      userId,
      items: orderItems,
      totalItemCost,
      deliveryFee,
    });
  }

  async refundItem(campaignId: string, itemId: string): Promise<void> {
    const orders = await this.orderModel.find({ campaignId, status: MarketPoolOrderStatus.PAID });
    for (const order of orders) {
      const orderItem = order.items.find(i => i.itemId.toString() === itemId);
      if (orderItem) {
        const refundAmount = orderItem.priceAtPurchase * orderItem.quantity;
        await this.walletsService.fundWalletByAdmin(
          order.userId.toString(),
          refundAmount,
          `Refund for unavailable market pool item`
        );
        order.status = MarketPoolOrderStatus.PARTIALLY_REFUNDED;
        await order.save();
      }
    }
  }

  async getAggregation(campaignId: string): Promise<any> {
    return this.orderModel.aggregate([
      { $match: { campaignId: new Types.ObjectId(campaignId), status: { $ne: 'refunded' } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.itemId',
          totalQuantity: { $sum: '$items.quantity' },
        },
      },
      {
        $lookup: {
          from: 'marketpoolitems',
          localField: '_id',
          foreignField: '_id',
          as: 'item',
        },
      },
      { $unwind: '$item' },
    ]);
  }
}
