import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderStatus, LocationType, PaymentStatus } from '../schemas/order.schema';
import { DeliveryBid, DeliveryBidStatus } from '../schemas/delivery-bid.schema';
import { Errander } from '../../erranders/schemas/errander.schema';
import { User } from '../../users/schemas/user.schema';
import { WalletsService } from '../../wallets/wallets.service';
import { NotificationsService } from '../../notifications/notifications.service';

@Injectable()
export class NegotiationService {
  private readonly logger = new Logger(NegotiationService.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
    @InjectModel(DeliveryBid.name) private readonly deliveryBidModel: Model<DeliveryBid>,
    @InjectModel(Errander.name) private readonly erranderModel: Model<Errander>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
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

    if (order.type === 'custom_errand') {
      const wallet = await this.walletsService.getWallet(riderId);
      const requiredBalance = bidAmount * 0.20;
      if (wallet && wallet.balance < requiredBalance) {
        throw new BadRequestException(`Your wallet balance is too low to bid on this custom errand. You need at least ₦${requiredBalance} in your wallet to cover the platform fee.`);
      }
    }

    // Check if the rider already placed a bid
    const existingBid = await this.deliveryBidModel.findOne({ order: new Types.ObjectId(orderId), rider: new Types.ObjectId(riderId) });
    
    if (existingBid) {
      if (!existingBid.originalAmount) existingBid.originalAmount = existingBid.bidAmount;
      existingBid.bidAmount = bidAmount;
      existingBid.status = DeliveryBidStatus.COUNTER_OFFER;
      existingBid.lastNegotiatorRole = 'errander';
      await existingBid.save();
      return existingBid;
    }

    const newBid = await this.deliveryBidModel.create({
      order: new Types.ObjectId(orderId),
      rider: new Types.ObjectId(riderId),
      bidAmount,
      status: DeliveryBidStatus.PENDING,
      lastNegotiatorRole: 'errander',
    });

    await this.notificationsService.sendNotification(order.customer.toString(), {
      title: 'New Bid Received',
      body: `A rider has proposed a delivery fee of ₦${bidAmount} for your errand.`,
      type: 'ORDER_BIDS_UPDATE',
      data: { orderId: order._id.toString() },
    });

    return newBid;
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
    
    // Update total (delivery fee wasn't added to total yet, or if it was, it was proposed)
    // First remove proposed, then add agreed
    if (order.proposedDeliveryFee) {
        order.total = order.total - order.proposedDeliveryFee + bid.bidAmount;
    } else {
        order.total = order.total + bid.bidAmount;
    }
    order.deliveryFee = bid.bidAmount;
    
    // Deduct 20% platform fee from the negotiated delivery fee
    const platformCommission = bid.bidAmount * 0.20;
    order.platformShare = (order.platformShare || 0) + platformCommission;
    order.erranderPayout = bid.bidAmount - platformCommission;
    order.erranderShare = order.erranderPayout;
    
    await order.save();

    return { order, bid };
  }

  async getBidsForOrder(orderId: string) {
    return this.deliveryBidModel.find({ order: new Types.ObjectId(orderId) }).populate('rider', 'firstName lastName avatar phone').sort({ createdAt: -1 });
  }
}
