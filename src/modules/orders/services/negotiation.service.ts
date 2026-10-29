import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderStatus, LocationType, PaymentStatus } from '../schemas/order.schema';
import { DeliveryBid, DeliveryBidStatus } from '../schemas/delivery-bid.schema';
import { Errander } from '../../erranders/schemas/errander.schema';
import { User } from '../../users/schemas/user.schema';
import { WalletsService } from '../../wallets/wallets.service';
import { NotificationsService } from '../../notifications/notifications.service';

import { SystemSetting } from '../../admin/schemas/system-setting.schema';

@Injectable()
export class NegotiationService {
  private readonly logger = new Logger(NegotiationService.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
    @InjectModel(DeliveryBid.name) private readonly deliveryBidModel: Model<DeliveryBid>,
    @InjectModel(Errander.name) private readonly erranderModel: Model<Errander>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(SystemSetting.name) private readonly settingModel: Model<SystemSetting>,
    private readonly walletsService: WalletsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async submitBid(orderId: string, riderId: string, bidAmount: number) {
    const order = await this.orderModel.findById(orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.status !== OrderStatus.NEGOTIATING) {
      throw new BadRequestException('Order is no longer accepting bids');
    }



    // Check if the rider already placed a bid
    let existingBid = await this.deliveryBidModel.findOne({ order: new Types.ObjectId(orderId), rider: new Types.ObjectId(riderId) });
    
    if (existingBid) {
      if (!existingBid.originalAmount) existingBid.originalAmount = existingBid.bidAmount;
      existingBid.bidAmount = bidAmount;
      existingBid.status = DeliveryBidStatus.COUNTER_OFFER;
      existingBid.lastNegotiatorRole = 'errander';
      await existingBid.save();
    } else {
      existingBid = await this.deliveryBidModel.create({
        order: new Types.ObjectId(orderId),
        rider: new Types.ObjectId(riderId),
        bidAmount,
        status: DeliveryBidStatus.PENDING,
        lastNegotiatorRole: 'errander',
      });
    }

    await this.notificationsService.sendNotification(order.customer.toString(), {
      title: 'New Bid Received',
      body: `A rider has proposed a delivery fee of ₦${bidAmount} for your errand.`,
      type: 'ORDER_BIDS_UPDATE',
      data: { orderId: order._id.toString() },
    });

    const activeBid = existingBid;

    // Trigger webhook for barter transactions
    const barterTxId = order.barterTransactionId || (order.customDetails?.description?.match(/\[Barter Tx ID:\s*([^\]\s]+)\]/)?.[1]);
    if (barterTxId) {
      const rawBase = (process.env.BARTER_API_URL || 'https://barter-backend-api.erranders.org/api/v1').trim();
      const cleanBase = rawBase.replace(/\/+$/, '');
      const finalBase = cleanBase.endsWith('/api/v1') ? cleanBase : `${cleanBase}/api/v1`;
      const webhookUrl = `${finalBase}/escrow/webhook/negotiation`;
      const apiKey = (process.env.BARTER_API_KEY || process.env.BARTER_SECRET_KEY || 'barter_secret_123').trim();

      try {
        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
          body: JSON.stringify({
            barterTransactionId: barterTxId.trim(),
            orderId: order._id.toString(),
            bidId: activeBid._id.toString(),
            proposedFee: bidAmount
          })
        });
        const text = await res.text();
        this.logger.log(`Barter Webhook Response: ${res.status} - ${text}`);
      } catch (e) {
        this.logger.error(`Failed to notify barter about negotiation at ${webhookUrl}: ${e.message}`, e.stack);
      }
    }

    return activeBid;
  }

  async acceptBid(orderId: string, bidId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.status !== OrderStatus.NEGOTIATING) {
      throw new BadRequestException('Order is no longer accepting bids');
    }

    const bid = await this.deliveryBidModel.findById(bidId);
    if (!bid || bid.order.toString() !== orderId) {
      throw new NotFoundException('Bid not found');
    }

    // Accept this bid
    bid.status = DeliveryBidStatus.ACCEPTED;
    await bid.save();

    // Reject all other bids
    await this.deliveryBidModel.updateMany(
      { order: new Types.ObjectId(orderId), _id: { $ne: bid._id } },
      { $set: { status: DeliveryBidStatus.REJECTED } }
    );

    // Update order status
    order.agreedDeliveryFee = bid.bidAmount;
    order.errander = bid.rider;
    order.status = OrderStatus.AWAITING_PAYMENT;
    order.statusHistory.push({
      status: OrderStatus.AWAITING_PAYMENT,
      timestamp: new Date(),
      note: `Negotiation complete. Agreed fee: ${bid.bidAmount}`,
    });
    
    // Read dynamic settings
    const errandSetting = await this.settingModel.findOne({ key: 'custom_errand' }).exec();
    const commissionPercent = Number(errandSetting?.value?.customErrandCommissionPercentage ?? 20);
    const customerFixedFee = Number(errandSetting?.value?.customErrandCustomerFee ?? errandSetting?.value?.convenienceFee ?? 100);
    const ninjaCommission = Math.round(bid.bidAmount * (commissionPercent / 100));
    const erranderPayout = Math.max(0, bid.bidAmount - ninjaCommission);

    order.deliveryFee = bid.bidAmount;

    if (order.type === 'custom_errand') {
      const itemCost = Number(order.customDetails?.estimatedItemCost || order.subtotal || 0);
      order.serviceFee = customerFixedFee;
      order.erranderPayout = erranderPayout;
      order.erranderShare = erranderPayout;
      order.platformShare = customerFixedFee + ninjaCommission;
      order.total = itemCost + bid.bidAmount + customerFixedFee;
    } else {
      if (order.proposedDeliveryFee) {
        order.total = order.total - order.proposedDeliveryFee + bid.bidAmount;
      } else {
        order.total = order.total + bid.bidAmount;
      }
      const oldCommission = order.proposedDeliveryFee ? Math.round(order.proposedDeliveryFee * (commissionPercent / 100)) : 0;
      order.platformShare = (order.platformShare || 0) - oldCommission + ninjaCommission;
      order.erranderPayout = erranderPayout;
      order.erranderShare = erranderPayout;
    }
    
    await order.save();

    return { order, bid };
  }

  async getBidsForOrder(orderId: string) {
    return this.deliveryBidModel.find({ order: new Types.ObjectId(orderId) }).populate('rider', 'firstName lastName avatar phone').sort({ createdAt: -1 });
  }
}
