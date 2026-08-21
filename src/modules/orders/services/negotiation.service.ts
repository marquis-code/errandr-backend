import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderStatus, LocationType, PaymentStatus } from '../schemas/order.schema';
import { DeliveryBid, DeliveryBidStatus } from '../schemas/delivery-bid.schema';
import { Errander } from '../../erranders/schemas/errander.schema';
import { User } from '../../users/schemas/user.schema';

@Injectable()
export class NegotiationService {
  private readonly logger = new Logger(NegotiationService.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
    @InjectModel(DeliveryBid.name) private readonly deliveryBidModel: Model<DeliveryBid>,
    @InjectModel(Errander.name) private readonly erranderModel: Model<Errander>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
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
    const existingBid = await this.deliveryBidModel.findOne({ order: new Types.ObjectId(orderId), rider: new Types.ObjectId(riderId) });
    
    if (existingBid) {
      existingBid.bidAmount = bidAmount;
      existingBid.status = DeliveryBidStatus.PENDING;
      await existingBid.save();
      return existingBid;
    }

    const newBid = await this.deliveryBidModel.create({
      order: new Types.ObjectId(orderId),
      rider: new Types.ObjectId(riderId),
      bidAmount,
      status: DeliveryBidStatus.PENDING,
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
    
    await order.save();

    return { order, bid };
  }

  async getBidsForOrder(orderId: string) {
    return this.deliveryBidModel.find({ order: new Types.ObjectId(orderId) }).populate('rider', 'firstName lastName avatar phone').sort({ createdAt: -1 });
  }
}
